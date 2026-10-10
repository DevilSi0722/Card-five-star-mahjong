import type {
  EngineSeatId,
  GuestActionInput,
  NetGameView,
  QuickChatMessage,
  Room,
  RoomSettings,
  Wind,
} from "@/types/multiplayer";
import type { GameSyncPacket } from "@/lib/multiplayer/syncProtocol";

export type RealtimeAction = Omit<GuestActionInput, "seat"> & {
  actionId?: string;
  round?: number;
  context?: string;
};

export interface ActionReceipt {
  actionId?: string;
  round: number;
  rev: number;
}

export interface SyncCursor { roomCode: string; round: number; rev: number }

export interface RealtimeSession {
  room: Room;
  myWind: Wind;
  /** 用于同一设备断线后重新取得自己的座位，不能分享给其他玩家。 */
  sessionToken: string;
}

export type RealtimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateRoomRequest {
  clientId: string;
  name: string;
  settings: RoomSettings;
  code?: string;
}

export interface JoinRoomRequest {
  clientId: string;
  name: string;
  code: string;
  sessionToken?: string;
}

export interface SocketIdentity {
  clientId: string;
  code: string;
  sessionToken: string;
}

export interface ClientToServerEvents {
  "room:create": (request: CreateRoomRequest, ack: (result: RealtimeResult<RealtimeSession>) => void) => void;
  "room:join": (request: JoinRoomRequest, ack: (result: RealtimeResult<RealtimeSession>) => void) => void;
  "room:choose-wind": (wind: Wind, ack: (result: RealtimeResult<Room>) => void) => void;
  "room:update-settings": (settings: RoomSettings, ack: (result: RealtimeResult<Room>) => void) => void;
  "room:start": (ack: (result: RealtimeResult<Room>) => void) => void;
  "room:ready": (round: number, ack: (result: RealtimeResult<Room>) => void) => void;
  "room:chat": (text: string, ack: (result: RealtimeResult<void>) => void) => void;
  "room:leave": (ack: (result: RealtimeResult<void>) => void) => void;
  "game:action": (action: RealtimeAction, ack: (result: RealtimeResult<ActionReceipt>) => void) => void;
  "game:resync": (ack: (result: RealtimeResult<void>) => void) => void;
  "realtime:ping": (ack: (result: RealtimeResult<SyncCursor | null>) => void) => void;
}

export interface ServerToClientEvents {
  "room:update": (room: Room) => void;
  "room:closed": (message: string) => void;
  "game:view": (view: NetGameView) => void;
  "game:sync": (packet: GameSyncPacket) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  identity?: SocketIdentity;
  syncProtocol?: number;
}

export type RealtimeSeat = EngineSeatId;
