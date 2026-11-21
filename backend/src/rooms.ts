import {
  isDbAvailable, dbListManagedRooms, dbCreateManagedRoom, dbSetManagedRoomClosed, dbDeleteManagedRoom,
} from "./db";

// 관리자가 만든 방 장부. 참가자는 여기 등록되고 마감되지 않은 방에만 들어올 수 있음.
// 작은 목록이라 메모리에 전부 올려 두고 DB와 함께 갱신 (입장할 때마다 DB를 조회하지 않도록).

export interface ManagedRoom { roomId: string; title: string | null; createdAt: string; closedAt: string | null }

const rooms = new Map<string, ManagedRoom>();

// 로컬 개발용: OPEN_ROOMS=1 이면 등록 안 된 방에도 입장 허용
export const openRoomsMode = () => process.env.OPEN_ROOMS === "1";

/** 방 코드 규칙: 영문·숫자·한글·-·_ 1~40자 */
export const ROOM_CODE_RE = /^[A-Za-z0-9가-힣_-]{1,40}$/;

export async function loadRooms(): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    rooms.clear();
    for (const r of await dbListManagedRooms()) rooms.set(r.roomId, r);
    console.log(`📋 관리 대상 방 ${rooms.size}개`);
  } catch (e) {
    console.error("방 목록 불러오기 실패 (서버는 계속 실행):", e);
  }
}

export const getRoom = (roomId: string) => rooms.get(roomId) ?? null;
export const listRooms = () => [...rooms.values()];

export async function createRoom(roomId: string, title: string | null): Promise<ManagedRoom | null> {
  if (rooms.has(roomId)) return null;
  const ok = await dbCreateManagedRoom(roomId, title);
  if (!ok && isDbAvailable()) return null;
  const r = { roomId, title, createdAt: new Date().toISOString(), closedAt: null };
  rooms.set(roomId, r);
  return r;
}

export async function setRoomClosed(roomId: string, closed: boolean): Promise<ManagedRoom | null> {
  const r = rooms.get(roomId);
  if (!r) return null;
  await dbSetManagedRoomClosed(roomId, closed);
  r.closedAt = closed ? new Date().toISOString() : null;
  return r;
}

export async function removeRoom(roomId: string): Promise<void> {
  await dbDeleteManagedRoom(roomId);
  rooms.delete(roomId);
}

/** 입장 가능 여부 — 안 되면 참가자에게 보여 줄 메시지 */
export function joinBlockReason(roomId: string): string | null {
  const r = rooms.get(roomId);
  if (!r) return openRoomsMode() ? null : "없는 방입니다. 관리자에게 받은 링크로 들어와 주세요.";
  if (r.closedAt) return "이미 마감된 방입니다. 참여해 주셔서 감사합니다.";
  return null;
}
