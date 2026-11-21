import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  isDbAvailable, dbListRooms, dbStorage, dbGetRoomFull, dbDeleteRoom, dbRestoreRoom,
} from "./db";
import { getEvents, memoryEventRooms, clearMemoryEvents, logEvent } from "./events";
import { computeMetrics, buildCsv, CSV_KINDS, CsvKind, RoomData } from "./metrics";

// 관리자 API — ADMIN_PASSWORD 환경변수가 있을 때만 동작

export interface AdminContext {
  liveSessions: () => { roomId: string; userName: string; joinedAt: string }[];
  ramRoom: (roomId: string) => Omit<RoomData, "events"> | null;
  ramRoomIds: () => string[];
  clearRoomCache: (roomId: string) => void;
  roomHasUsers: (roomId: string) => boolean;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const VOLUME_LIMIT_BYTES = Number(process.env.DB_VOLUME_MB || 500) * 1024 * 1024;

function sign(exp: number, password: string): string {
  return crypto.createHmac("sha256", password).update(`admin:${exp}`).digest("hex");
}

function verifyToken(token: string | undefined, password: string): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const expected = Buffer.from(sign(exp, password));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
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

// async 핸들러의 오류를 express 오류 처리로 넘김 (Express 4는 자동으로 안 잡음)
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

const ROOM_ID_RE = /^[^\/\\]{1,100}$/;

export function createAdminRouter(ctx: AdminContext) {
  const router = express.Router();
  router.use(express.json({ limit: "200mb" })); // 백업 복원용

  const password = () => process.env.ADMIN_PASSWORD || "";

  router.post("/login", (req, res) => {
    if (!password()) return res.status(503).json({ error: "관리자 비밀번호(ADMIN_PASSWORD)가 서버에 설정되지 않았습니다." });
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.ip || "unknown";
    if (tooManyAttempts(ip)) return res.status(429).json({ error: "시도가 너무 많습니다. 10분 뒤에 다시 시도하세요." });
    const given = typeof req.body?.password === "string" ? req.body.password : "";
    if (!safeEqual(given, password())) return res.status(401).json({ error: "비밀번호가 틀렸습니다." });
    const exp = Date.now() + TOKEN_TTL_MS;
    res.json({ token: `${exp}.${sign(exp, password())}`, expiresAt: new Date(exp).toISOString() });
  });

  // 이하 모든 경로는 인증 필요
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!password()) return res.status(503).json({ error: "ADMIN_PASSWORD 미설정" });
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!verifyToken(token, password())) return res.status(401).json({ error: "로그인이 필요합니다." });
    next();
  });

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
    const storage = await dbStorage();
    res.json({
      db: isDbAvailable(),
      storage: storage ? { ...storage, limitBytes: VOLUME_LIMIT_BYTES } : null,
      live,
      rooms: rooms.map((r) => ({ ...r, liveUsers: live.filter((s) => s.roomId === r.roomId).length })),
      serverTime: new Date().toISOString(),
    });
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
    res.send(buildCsv(kind, room, o));
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
    await dbRestoreRoom(roomId, backup);
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
