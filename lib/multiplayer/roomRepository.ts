import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type {
  EngineSeatId,
  NetAction,
  NetGameView,
  QuickChatMessage,
  Room,
  RoomPlayer,
  RoomSettings,
  Wind,
} from "@/types/multiplayer";
import { SEAT_TURN_ORDER, WIND_DISPLAY_ORDER } from "@/types/multiplayer";

const ROOMS = "rooms";

function roomRef(code: string) {
  return doc(getDb(), ROOMS, code);
}

function viewRef(code: string, seat: EngineSeatId) {
  return doc(getDb(), ROOMS, code, "views", seat);
}

function actionsCol(code: string) {
  return collection(getDb(), ROOMS, code, "actions");
}

function actionRef(code: string, seat: EngineSeatId) {
  return doc(getDb(), ROOMS, code, "actions", seat);
}

function presenceCol(code: string) {
  return collection(getDb(), ROOMS, code, "presence");
}

function presenceRef(code: string, clientId: string) {
  return doc(getDb(), ROOMS, code, "presence", clientId);
}

/** 读取房间一次。 */
export async function fetchRoom(code: string): Promise<Room | null> {
  const snap = await getDoc(roomRef(code));
  return snap.exists() ? (snap.data() as Room) : null;
}

/** 创建房间；若房间号已存在则抛错。 */
export async function createRoom(room: Room): Promise<void> {
  await runTransaction(getDb(), async (tx) => {
    const ref = roomRef(room.code);
    const existing = await tx.get(ref);
    if (existing.exists()) {
      throw new Error("房间号已被占用，请换一个");
    }
    tx.set(ref, { ...room, createdAt: Date.now(), updatedAt: Date.now() });
  });
}

/**
 * 加入房间：事务内校验状态与人数，分配一个空闲风位。
 * 返回分配到的风位。
 */
export async function joinRoom(code: string, player: Omit<RoomPlayer, "wind">): Promise<Wind> {
  return runTransaction(getDb(), async (tx) => {
    const ref = roomRef(code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("房间不存在");
    const room = snap.data() as Room;

    // 同一 clientId 或同昵称真人重连：沿用原风位，并把座位迁移到当前设备的 clientId。
    const reconnectName = player.name.trim();
    const already =
      room.players.find((p) => p.clientId === player.clientId) ??
      (reconnectName
        ? room.players.find((p) => !p.isAi && p.name.trim() === reconnectName)
        : undefined);
    if (already) {
      const now = Date.now();
      const players = room.players.map((p) =>
        p.clientId === already.clientId
          ? { ...p, clientId: player.clientId, lastSeen: now, name: player.name }
          : p,
      );
      const patch: Record<string, unknown> = { players, updatedAt: now };
      if (already.isHost || room.hostClientId === already.clientId) {
        patch.hostClientId = player.clientId;
      }
      if (room.readyClients) {
        patch.readyClients = Array.from(
          new Set(room.readyClients.map((clientId) => (clientId === already.clientId ? player.clientId : clientId))),
        );
      }
      tx.update(ref, patch);
      return already.wind;
    }

    if (room.status !== "waiting") throw new Error("该房间已开始游戏，只能原玩家重连");

    // 暂时仍最多三人（留一个风位空着）。
    if (room.players.length >= 3) throw new Error("房间已满");
    const takenWinds = new Set(room.players.map((p) => p.wind));
    const freeWind = WIND_DISPLAY_ORDER.find((w) => !takenWinds.has(w));
    if (!freeWind) throw new Error("房间已满");

    const seated: RoomPlayer = { ...player, wind: freeWind };
    tx.update(ref, { players: [...room.players, seated], updatedAt: Date.now() });
    return freeWind;
  });
}

/**
 * 切换自己的风位（仅等候室、目标风位空闲时允许）。
 * 返回切换后的风位。
 */
export async function chooseWind(code: string, clientId: string, wind: Wind): Promise<Wind> {
  return runTransaction(getDb(), async (tx) => {
    const ref = roomRef(code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("房间不存在");
    const room = snap.data() as Room;
    if (room.status !== "waiting") throw new Error("游戏已开始，无法切换风位");

    const me = room.players.find((p) => p.clientId === clientId);
    if (!me) throw new Error("你不在该房间内");
    if (me.wind === wind) return wind;
    if (room.players.some((p) => p.wind === wind)) throw new Error("该风位已被占用");

    const players = room.players.map((p) => (p.clientId === clientId ? { ...p, wind } : p));
    tx.update(ref, { players, updatedAt: Date.now() });
    return wind;
  });
}

/** 更新房间设置（仅房主调用）。 */
export async function updateRoomSettings(code: string, settings: RoomSettings): Promise<void> {
  await updateDoc(roomRef(code), { settings, updatedAt: Date.now() });
}

/** 覆盖写入整份玩家列表（用于补 AI、剔除掉线者）。 */
export async function updateRoomPlayers(code: string, players: RoomPlayer[]): Promise<void> {
  await updateDoc(roomRef(code), { players, updatedAt: Date.now() });
}

/** 更新房间状态与当前局数。 */
export async function updateRoomProgress(
  code: string,
  patch: Partial<Pick<Room, "status" | "currentRound">>,
): Promise<void> {
  await updateDoc(roomRef(code), { ...patch, updatedAt: Date.now() });
}

/** 本局结算后，某真人玩家点「准备」（事务内幂等加入 readyClients）。 */
export async function markReady(code: string, clientId: string, round: number): Promise<void> {
  await runTransaction(getDb(), async (tx) => {
    const ref = roomRef(code);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const room = snap.data() as Room;
    if (room.status !== "playing" || room.currentRound !== round) return;
    const ready = new Set(room.readyClients ?? []);
    if (ready.has(clientId)) return;
    ready.add(clientId);
    tx.update(ref, { readyClients: Array.from(ready), updatedAt: Date.now() });
  });
}

/** 房主开下一局：递增局数并清空准备名单。 */
export async function beginNextRound(code: string, nextRound: number): Promise<void> {
  await updateDoc(roomRef(code), {
    currentRound: nextRound,
    readyClients: [],
    updatedAt: Date.now(),
  });
}

/** 发送局内快捷聊天：覆盖房间文档里的最近一条，复用现有房间订阅，避免额外监听。 */
export async function sendQuickChat(code: string, message: QuickChatMessage): Promise<void> {
  await updateDoc(roomRef(code), { quickChat: message, updatedAt: Date.now() });
}

/** 成员心跳：刷新自己的 lastSeen。 */
export async function heartbeat(code: string, clientId: string): Promise<void> {
  await setDoc(presenceRef(code, clientId), { clientId, lastSeen: Date.now() });
}

/** 删除房间的所有子集合文档（views/*、actions/* 与 presence/*）。Firestore 删文档不级联删子集合，需手动清理。 */
async function deleteRoomSubcollections(code: string): Promise<void> {
  const batch = writeBatch(getDb());
  // views：座位固定为三个，直接逐个删。
  for (const seat of SEAT_TURN_ORDER) batch.delete(viewRef(code, seat));
  // actions：数量不定，查询后逐条删。
  const actionsSnap = await getDocs(actionsCol(code));
  for (const actionDoc of actionsSnap.docs) batch.delete(actionDoc.ref);
  const presenceSnap = await getDocs(presenceCol(code));
  for (const presenceDoc of presenceSnap.docs) batch.delete(presenceDoc.ref);
  await batch.commit();
}

/** 离开房间：房主离开则删除整个房间；非房主在对局中只断开本机，保留座位以便重连。 */
export async function leaveRoom(code: string, clientId: string): Promise<void> {
  const room = await fetchRoom(code);
  if (!room) return;
  if (room.hostClientId === clientId) {
    // 先清子集合（视图/动作/心跳），再删房间文档，避免遗留孤儿数据。
    // 删除房间后再补清一次，覆盖本客户端心跳/发布视图刚好并发写入的情况。
    await deleteRoomSubcollections(code);
    await deleteDoc(roomRef(code));
    await deleteRoomSubcollections(code);
    return;
  }
  if (room.status !== "waiting") {
    const players = room.players.map((p) => (p.clientId === clientId ? { ...p, lastSeen: Date.now() } : p));
    await Promise.all([
      updateDoc(roomRef(code), { players, updatedAt: Date.now() }),
      deleteDoc(presenceRef(code, clientId)).catch(() => undefined),
    ]);
    return;
  }
  const players = room.players.filter((p) => p.clientId !== clientId);
  await Promise.all([
    updateDoc(roomRef(code), { players, updatedAt: Date.now() }),
    deleteDoc(presenceRef(code, clientId)).catch(() => undefined),
  ]);
}

/** 订阅房间文档变化。 */
export function subscribeRoom(code: string, onChange: (room: Room | null) => void): Unsubscribe {
  return onSnapshot(roomRef(code), (snap) => {
    onChange(snap.exists() ? (snap.data() as Room) : null);
  });
}

/** 房主发布某座位的牌局视图。 */
export async function publishView(code: string, view: NetGameView): Promise<void> {
  await setDoc(viewRef(code, view.forSeat), view);
}

/** 读取某座位当前牌局视图一次，用于重连时立即恢复画面。 */
export async function fetchView(code: string, seat: EngineSeatId): Promise<NetGameView | null> {
  const snap = await getDoc(viewRef(code, seat));
  return snap.exists() ? (snap.data() as NetGameView) : null;
}

/** guest 订阅属于自己座位的牌局视图。 */
export function subscribeView(
  code: string,
  seat: EngineSeatId,
  onChange: (view: NetGameView | null) => void,
): Unsubscribe {
  return onSnapshot(viewRef(code, seat), (snap) => {
    onChange(snap.exists() ? (snap.data() as NetGameView) : null);
  });
}

/** guest 发送一条动作给房主；每个座位固定一个动作文档，覆盖写入以减少清理写入。 */
export async function sendAction(code: string, action: NetAction): Promise<void> {
  await setDoc(actionRef(code, action.seat), action);
}

/** 房主订阅动作队列；固定文档首次出现或被覆盖时回调。 */
export function subscribeActions(code: string, onAction: (action: NetAction) => void): Unsubscribe {
  let initialized = false;
  return onSnapshot(actionsCol(code), (snap) => {
    for (const change of snap.docChanges()) {
      const action = change.doc.data() as NetAction;
      if (change.doc.id !== action.seat) continue;
      if (!initialized && change.type === "added") continue;
      if (change.type === "added" || change.type === "modified") onAction(action);
    }
    initialized = true;
  });
}

/** 旧动作队列的清理入口保留兼容；固定动作文档用 seq 去重，不再逐条删除。 */
export async function consumeAction(code: string, actionId: string): Promise<void> {
  void code;
  void actionId;
}

export { serverTimestamp };
