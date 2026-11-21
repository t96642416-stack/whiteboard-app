import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  isDbAvailable, dbListRooms, dbStorage, dbGetRoomFull, dbDeleteRoom, dbRestoreRoom, dbGetSetting, dbSetSetting,
} from "./db";
import { getEvents, memoryEventRooms, clearMemoryEvents, logEvent } from "./events";
import { computeMetrics, buildCsv, CSV_KINDS, CsvKind, RoomData } from "./metrics";
import { listRooms, getRoom, createRoom, setRoomClosed, removeRoom, ROOM_CODE_RE } from "./rooms";

// 관리자 API — 비밀번호(ADMIN_PASSWORD 또는 화면에서 바꾼 값)가 있을 때만 동작

export interface AdminContext {
  liveSessions: () => { roomId: string; userName: string; joinedAt: string }[];
  ramRoom: (roomId: string) => Omit<RoomData, "events"> | null;
  ramRoomIds: () => string[];
  clearRoomCache: (roomId: string) => void;
  roomHasUsers: (roomId: string) => boolean;
  closeRoomSockets: (roomId: string) => void;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const VOLUME_LIMIT_BYTES = Number(process.env.DB_VOLUME_MB || 500) * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;

// ── 비밀번호 저장소
// 처음엔 환경변수 ADMIN_PASSWORD로 로그인하고, 관리자 화면에서 바꾸면 DB에 scrypt 해시로 저장(이후엔 DB 값이 우선).
// 비밀번호를 잊으면 ADMIN_RESET_PASSWORD 환경변수로 초기화 (같은 값은 한 번만 적용되어 재시작해도 화면에서 바꾼 값이 유지됨).
interface PwHash { salt: string; hash: string }
interface AuthState { pw: PwHash | null; secret: string }

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function hashPassword(pw: string): PwHash {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") };
}

function checkHash(pw: string, h: PwHash): boolean {
  const given = crypto.scryptSync(pw, h.salt, 64);
  const stored = Buffer.from(h.hash, "hex");
  return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

let authPromise: Promise<AuthState> | null = null;
const memorySettings: Record<string, any> = {}; // DB 없을 때

async function getSetting(key: string) { return isDbAvailable() ? dbGetSetting(key) : memorySettings[key] ?? null; }
async function setSetting(key: string, value: any) { if (isDbAvailable()) await dbSetSetting(key, value); else memorySettings[key] = value; }

async function loadAuth(): Promise<AuthState> {
  let pw: PwHash | null = await getSetting("admin_password");
  let secret: string | null = await getSetting("token_secret");
  const reset = process.env.ADMIN_RESET_PASSWORD;
  if (reset && reset.length >= MIN_PASSWORD_LENGTH && (await getSetting("reset_marker")) !== sha256(reset)) {
    pw = hashPassword(reset);
    secret = null; // 기존 로그인 모두 만료
    await setSetting("admin_password", pw);
    await setSetting("reset_marker", sha256(reset));
    console.log("[관리자] ADMIN_RESET_PASSWORD로 비밀번호를 초기화했습니다. 이 환경변수는 지워도 됩니다.");
  }
  if (!secret) { secret = crypto.randomBytes(32).toString("hex"); await setSetting("token_secret", secret); }
  return { pw, secret };
}
function auth(): Promise<AuthState> {
  if (!authPromise) authPromise = loadAuth().catch((e) => { authPromise = null; throw e; });
  return authPromise;
}

function passwordConfigured(a: AuthState) { return !!a.pw || !!process.env.ADMIN_PASSWORD; }
function verifyPassword(given: string, a: AuthState): boolean {
  if (a.pw) return checkHash(given, a.pw);
  const env = process.env.ADMIN_PASSWORD;
  return !!env && safeEqual(given, env);
}

function sign(exp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`admin:${exp}`).digest("hex");
}
function issueToken(secret: string) {
  const exp = Date.now() + TOKEN_TTL_MS;
  return { token: `${exp}.${sign(exp, secret)}`, expiresAt: new Date(exp).toISOString() };
}
function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const expected = Buffer.from(sign(exp, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// 로그인 시도 제한: IP당 10분에 10번
const attempts = new Map<string, { count: number; resetAt: number }>();
function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.resetAt < now) { attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 }); return false; }
  a.count++;
  return a.count > 10;
}
const clientIp = (req: Request) => (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.ip || "unknown";

// async 핸들러의 오류를 express 오류 처리로 넘김 (Express 4는 자동으로 안 잡음)
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

const ROOM_ID_RE = /^[^\/\\]{1,100}$/;

export function createAdminRouter(ctx: AdminContext) {
  const router = express.Router();
  router.use(express.json({ limit: "200mb" })); // 백업 복원용

  router.post("/login", wrap(async (req, res) => {
    const a = await auth();
    if (!passwordConfigured(a)) return res.status(503).json({ error: "관리자 비밀번호(ADMIN_PASSWORD)가 서버에 설정되지 않았습니다." });
    if (tooManyAttempts(clientIp(req))) return res.status(429).json({ error: "시도가 너무 많습니다. 10분 뒤에 다시 시도하세요." });
    const given = typeof req.body?.password === "string" ? req.body.password : "";
    if (!verifyPassword(given, a)) return res.status(401).json({ error: "비밀번호가 틀렸습니다." });
    res.json(issueToken(a.secret));
  }));

  // 이하 모든 경로는 인증 필요
  router.use((req: Request, res: Response, next: NextFunction) => {
    auth().then((a) => {
      const h = req.headers.authorization;
      const token = h?.startsWith("Bearer ") ? h.slice(7) : undefined;
      if (!verifyToken(token, a.secret)) return res.status(401).json({ error: "로그인이 필요합니다." });
      next();
    }).catch(next);
  });

  router.get("/me", wrap(async (_req, res) => {
    const a = await auth();
    res.json({ passwordSource: a.pw ? "changed" : "env" });
  }));

  // 비밀번호 변경 → 다른 기기의 로그인은 모두 만료, 현재 기기엔 새 토큰 발급
  router.post("/password", wrap(async (req, res) => {
    const a = await auth();
    if (tooManyAttempts(clientIp(req))) return res.status(429).json({ error: "시도가 너무 많습니다. 10분 뒤에 다시 시도하세요." });
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.next === "string" ? req.body.next : "";
    if (!verifyPassword(current, a)) return res.status(403).json({ error: "현재 비밀번호가 틀렸습니다.", field: "current" });
    if (next.length < MIN_PASSWORD_LENGTH || next.length > 200) return res.status(400).json({ error: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` });
    if (next === current) return res.status(400).json({ error: "현재 비밀번호와 다른 비밀번호를 입력하세요." });
    const pw = hashPassword(next);
    const secret = crypto.randomBytes(32).toString("hex");
    await setSetting("admin_password", pw);
    await setSetting("token_secret", secret);
    authPromise = Promise.resolve({ pw, secret });
    console.log("[관리자] 비밀번호가 변경되었습니다.");
    res.json(issueToken(secret));
  }));

  router.param("roomId", (_req, res, next, roomId) => {
    if (!ROOM_ID_RE.test(roomId)) return res.status(400).json({ error: "잘못된 방 ID" });
    next();
  });

  async function loadRoom(roomId: string): Promise<RoomData> {
    const events = await getEvents(roomId);
    if (isDbAvailable()) {
      const full = await dbGetRoomFull(roomId);
      return { ...(full as Omit<RoomData, "events">), events };
    }
    const ram = ctx.ramRoom(roomId);
    return {
      ideas: ram?.ideas ?? [], sections: ram?.sections ?? [], messages: ram?.messages ?? [],
      analysisResults: ram?.analysisResults ?? [], canvasImages: ram?.canvasImages ?? [], events,
    };
  }

  const opts = (req: Request) => ({
    anon: req.query.anon === "1" || req.query.anon === "true",
    windowMin: Math.min(120, Math.max(1, Number(req.query.window) || 5)),
  });

  router.get("/overview", wrap(async (_req, res) => {
    const live = ctx.liveSessions();
    let rooms: any[];
    if (isDbAvailable()) {
      rooms = await dbListRooms();
    } else {
      const ids = new Set([...ctx.ramRoomIds(), ...memoryEventRooms()]);
      rooms = [...ids].map((roomId) => {
        const r = ctx.ramRoom(roomId);
        return { roomId, ideas: r?.ideas.length ?? 0, sections: r?.sections.length ?? 0, messages: r?.messages.length ?? 0,
          analyses: r?.analysisResults.length ?? 0, images: r?.canvasImages.length ?? 0, events: null, bytes: null, lastActivity: null };
      });
    }
    // 접속자는 있지만 아직 저장된 데이터가 없는 방도 목록에 표시
    for (const s of live) if (!rooms.find((r) => r.roomId === s.roomId)) {
      rooms.push({ roomId: s.roomId, ideas: 0, sections: 0, messages: 0, analyses: 0, images: 0, events: 0, bytes: 0, lastActivity: null });
    }
    // 관리자가 만든 방(아직 데이터가 없는 방 포함)을 목록에 합치고 상태를 붙임
    for (const m of listRooms()) if (!rooms.find((r) => r.roomId === m.roomId)) {
      rooms.push({ roomId: m.roomId, ideas: 0, sections: 0, messages: 0, analyses: 0, images: 0, events: 0, bytes: 0, lastActivity: null });
    }
    rooms = rooms.map((r) => {
      const m = getRoom(r.roomId);
      return { ...r, title: m?.title ?? null, createdAt: m?.createdAt ?? null, status: !m ? "unregistered" : m.closedAt ? "closed" : "open", closedAt: m?.closedAt ?? null };
    });
    rooms.sort((a, b) => String(b.createdAt ?? b.lastActivity ?? "").localeCompare(String(a.createdAt ?? a.lastActivity ?? "")));
    const storage = await dbStorage();
    res.json({
      db: isDbAvailable(),
      storage: storage ? { ...storage, limitBytes: VOLUME_LIMIT_BYTES } : null,
      live,
      rooms: rooms.map((r) => ({ ...r, liveUsers: live.filter((s) => s.roomId === r.roomId).length })),
      serverTime: new Date().toISOString(),
    });
  }));

  // 방 만들기
  router.post("/rooms", wrap(async (req, res) => {
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim().slice(0, 60) : null;
    if (!ROOM_CODE_RE.test(roomId)) return res.status(400).json({ error: "방 코드는 영문·숫자·한글·-·_ 로 1~40자여야 합니다." });
    if (getRoom(roomId)) return res.status(409).json({ error: "이미 있는 방 코드입니다." });
    const existing = isDbAvailable() ? (await dbListRooms()).find((r) => r.roomId === roomId) : null;
    if (existing) return res.status(409).json({ error: "이 코드로 저장된 데이터가 이미 있습니다. 다른 코드를 쓰세요." });
    const room = await createRoom(roomId, title);
    if (!room) return res.status(409).json({ error: "이미 있는 방 코드입니다." });
    console.log(`[관리자] 방 만들기: ${roomId}`);
    res.json(room);
  }));

  // 방 마감 / 다시 열기
  router.post("/rooms/:roomId/close", wrap(async (req, res) => {
    const room = await setRoomClosed(req.params.roomId, true);
    if (!room) return res.status(404).json({ error: "관리 대상 방이 아닙니다." });
    ctx.closeRoomSockets(req.params.roomId);
    logEvent(req.params.roomId, null, "admin_close_room");
    res.json(room);
  }));
  router.post("/rooms/:roomId/reopen", wrap(async (req, res) => {
    const room = await setRoomClosed(req.params.roomId, false);
    if (!room) return res.status(404).json({ error: "관리 대상 방이 아닙니다." });
    logEvent(req.params.roomId, null, "admin_reopen_room");
    res.json(room);
  }));

  router.get("/rooms/:roomId/metrics", wrap(async (req, res) => {
    const room = await loadRoom(req.params.roomId);
    res.json(computeMetrics(room, opts(req)));
  }));

  router.get("/rooms/:roomId/csv/:kind", wrap(async (req, res) => {
    const kind = req.params.kind as CsvKind;
    if (!CSV_KINDS.includes(kind)) return res.status(400).json({ error: "알 수 없는 종류" });
    const room = await loadRoom(req.params.roomId);
    const o = opts(req);
    const file = `${req.params.roomId}-${kind}${o.anon ? "-anon" : ""}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file)}`);
    res.send(buildCsv(kind, room, o, req.params.roomId));
  }));

  router.get("/rooms/:roomId/backup", wrap(async (req, res) => {
    const room = await loadRoom(req.params.roomId);
    const file = `backup-${req.params.roomId}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file)}`);
    res.json({ format: "whiteboard-backup", version: 1, roomId: req.params.roomId, exportedAt: new Date().toISOString(), ...room });
  }));

  router.delete("/rooms/:roomId", wrap(async (req, res) => {
    const { roomId } = req.params;
    if (req.body?.confirm !== roomId) return res.status(400).json({ error: "확인용 방 ID가 일치하지 않습니다." });
    if (ctx.roomHasUsers(roomId)) return res.status(409).json({ error: "접속 중인 사용자가 있어 삭제할 수 없습니다." });
    await dbDeleteRoom(roomId);
    await removeRoom(roomId);
    clearMemoryEvents(roomId);
    ctx.clearRoomCache(roomId);
    console.log(`[관리자] 방 삭제: ${roomId}`);
    res.json({ ok: true });
  }));

  router.post("/rooms/:roomId/restore", wrap(async (req, res) => {
    const { roomId } = req.params;
    const backup = req.body;
    if (backup?.format !== "whiteboard-backup") return res.status(400).json({ error: "백업 파일 형식이 아닙니다." });
    if (!isDbAvailable()) return res.status(503).json({ error: "DB가 연결되지 않아 복원할 수 없습니다." });
    if (ctx.roomHasUsers(roomId)) return res.status(409).json({ error: "접속 중인 사용자가 있어 복원할 수 없습니다." });
    const existing = (await dbListRooms()).find((r) => r.roomId === roomId);
    if (existing && (existing.ideas || existing.sections || existing.messages || existing.analyses || existing.images)) {
      return res.status(409).json({ error: "비어 있지 않은 방입니다. 다른 방 ID를 쓰거나 먼저 삭제하세요." });
    }
    if (!ROOM_CODE_RE.test(roomId)) return res.status(400).json({ error: "방 코드는 영문·숫자·한글·-·_ 로 1~40자여야 합니다." });
    await dbRestoreRoom(roomId, backup);
    if (!getRoom(roomId)) await createRoom(roomId, backup.title ?? null);
    ctx.clearRoomCache(roomId);
    logEvent(roomId, null, "admin_restore", { from: backup.roomId, exportedAt: backup.exportedAt });
    console.log(`[관리자] 방 복원: ${backup.roomId} → ${roomId}`);
    res.json({ ok: true });
  }));

  router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[관리자] 오류:", err);
    res.status(err?.type === "entity.too.large" ? 413 : 500).json({ error: err?.message ?? "서버 오류" });
  });

  return router;
}
