import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type {
  EngineSeatId,
  NetAction,
  NetGameView,
  Room,
  RoomPlayer,
  RoomSettings,
} from "@/types/multiplayer";

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
 * 加入房间：事务内校验状态与座位余量，分配空闲座位。
 * 返回分配到的座位。
 */
export async function joinRoom(code: string, player: Omit<RoomPlayer, "seat">): Promise<EngineSeatId> {
  return runTransaction(getDb(), async (tx) => {
    const ref = roomRef(code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("房间不存在");
    const room = snap.data() as Room;
    if (room.status !== "waiting") throw new Error("该房间已开始游戏");

    // 同一 clientId 重连：沿用原座位。
    const already = room.players.find((p) => p.clientId === player.clientId);
    if (already) {
      const players = room.players.map((p) =>
        p.clientId === player.clientId ? { ...p, lastSeen: Date.now(), name: player.name } : p,
      );
      tx.update(ref, { players, updatedAt: Date.now() });
      return already.seat;
    }

    const takenSeats = new Set(room.players.map((p) => p.seat));
    const freeSeat = (["human", "ai_right", "ai_left"] as EngineSeatId[]).find((s) => !takenSeats.has(s));
    if (!freeSeat) throw new Error("房间已满");

    const seated: RoomPlayer = { ...player, seat: freeSeat };
    tx.update(ref, { players: [...room.players, seated], updatedAt: Date.now() });
    return freeSeat;
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

/** 成员心跳：刷新自己的 lastSeen。 */
export async function heartbeat(code: string, clientId: string): Promise<void> {
  const room = await fetchRoom(code);
  if (!room) return;
  const players = room.players.map((p) => (p.clientId === clientId ? { ...p, lastSeen: Date.now() } : p));
  await updateDoc(roomRef(code), { players });
}

/** 离开房间：房主离开则删除整个房间，否则移除自己。 */
export async function leaveRoom(code: string, clientId: string): Promise<void> {
  const room = await fetchRoom(code);
  if (!room) return;
  if (room.hostClientId === clientId) {
    await deleteDoc(roomRef(code));
    return;
  }
  const players = room.players.filter((p) => p.clientId !== clientId);
  await updateDoc(roomRef(code), { players, updatedAt: Date.now() });
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

/** guest 发送一条动作给房主。 */
export async function sendAction(code: string, action: NetAction): Promise<void> {
  await setDoc(doc(actionsCol(code), action.id), action);
}

/** 房主订阅动作队列；新动作到达时回调。 */
export function subscribeActions(code: string, onAction: (action: NetAction) => void): Unsubscribe {
  return onSnapshot(actionsCol(code), (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type === "added") onAction(change.doc.data() as NetAction);
    }
  });
}

/** 房主处理完动作后删除，避免重复消费。 */
export async function consumeAction(code: string, actionId: string): Promise<void> {
  await deleteDoc(doc(actionsCol(code), actionId));
}

export { serverTimestamp };
