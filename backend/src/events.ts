import { dbInsertEvent, dbGetEvents, isDbAvailable } from "./db";

// 연구용 행동 로그. 기록 실패가 앱 동작을 막지 않도록 항상 fire-and-forget.

export interface EventRow {
  id?: number;
  user: string | null;
  type: string;
  data: any;
  at: string;
}

const MAX_TEXT = 2000;
const MEMORY_LIMIT_PER_ROOM = 20000;
const memoryEvents: Record<string, EventRow[]> = {}; // DB 없을 때(로컬 개발)용

/** 이미지(base64)는 빼고, 긴 글은 잘라서 로그용 값으로 만든다 */
function sanitize(v: any, depth = 0): any {
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "[image]";
    return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) + "…" : v;
  }
  if (depth > 4) return undefined;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => sanitize(x, depth + 1));
  if (v && typeof v === "object") {
    const out: any = {};
    for (const k of Object.keys(v)) {
      const s = sanitize(v[k], depth + 1);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return v;
}

export function logEvent(roomId: string, user: string | null, type: string, data: any = {}): void {
  if (!roomId) return;
  const clean = sanitize(data);
  if (isDbAvailable()) {
    dbInsertEvent(roomId, user, type, clean).catch((e) => console.error("이벤트 기록 실패:", e?.message ?? e));
    return;
  }
  const list = (memoryEvents[roomId] ??= []);
  list.push({ id: list.length + 1, user, type, data: clean, at: new Date().toISOString() });
  if (list.length > MEMORY_LIMIT_PER_ROOM) list.splice(0, list.length - MEMORY_LIMIT_PER_ROOM);
}

export async function getEvents(roomId: string): Promise<EventRow[]> {
  if (isDbAvailable()) return dbGetEvents(roomId);
  return memoryEvents[roomId] ?? [];
}

export function memoryEventRooms(): string[] {
  return Object.keys(memoryEvents);
}

export function clearMemoryEvents(roomId: string): void {
  delete memoryEvents[roomId];
}
