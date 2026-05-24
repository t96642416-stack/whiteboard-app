import { Pool } from "pg";

// DATABASE_URL이 없으면 메모리 모드로 동작 (로컬 개발용)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Railway SSL
    })
  : null;

export const isDbAvailable = () => !!pool;

// 테이블 초기화 (서버 시작 시 1회 실행)
export async function initDb() {
  if (!pool) {
    console.log("📦 DB 없음 → 메모리 모드로 동작합니다.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, room_id)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, room_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id SERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ideas_room ON ideas(room_id);
    CREATE INDEX IF NOT EXISTS idx_sections_room ON sections(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_room ON analysis_results(room_id);
  `);
  console.log("✅ DB 테이블 준비 완료");
}

// ─── Ideas ──────────────────────────────────────────

export async function dbGetIdeas(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT data FROM ideas WHERE room_id = $1 ORDER BY created_at ASC",
    [roomId]
  );
  return res.rows.map((r) => r.data);
}

export async function dbUpsertIdea(roomId: string, idea: any): Promise<void> {
  if (!pool) return;
  // DB에는 이미지 포함 전체 저장 (RAM에는 안 올림 — index.ts에서 별도 처리)
  const toStore = { ...idea };
  await pool.query(
    `INSERT INTO ideas (id, room_id, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data`,
    [idea.id, roomId, JSON.stringify(toStore)]
  );
}

export async function dbUpdateIdea(roomId: string, ideaId: string, patch: Partial<any>): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE ideas
     SET data = data || $1::jsonb
     WHERE id = $2 AND room_id = $3`,
    [JSON.stringify(patch), ideaId, roomId]
  );
}

export async function dbDeleteIdea(roomId: string, ideaId: string): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM ideas WHERE id = $1 AND room_id = $2", [ideaId, roomId]);
}

export async function dbMoveIdea(roomId: string, ideaId: string, x: number, y: number): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE ideas SET data = data || $1::jsonb WHERE id = $2 AND room_id = $3`,
    [JSON.stringify({ x, y }), ideaId, roomId]
  );
}

// ─── Sections ───────────────────────────────────────

export async function dbGetSections(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT data FROM sections WHERE room_id = $1 ORDER BY created_at ASC",
    [roomId]
  );
  return res.rows.map((r) => r.data);
}

export async function dbUpsertSection(roomId: string, section: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO sections (id, room_id, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data`,
    [section.id, roomId, JSON.stringify(section)]
  );
}

export async function dbUpdateSection(roomId: string, update: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE sections SET data = data || $1::jsonb WHERE id = $2 AND room_id = $3`,
    [JSON.stringify(update), update.id, roomId]
  );
}

export async function dbDeleteSection(roomId: string, sectionId: string): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM sections WHERE id = $1 AND room_id = $2", [sectionId, roomId]);
}

// ─── Messages ───────────────────────────────────────

export async function dbGetMessages(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT data FROM messages WHERE room_id = $1 ORDER BY created_at ASC LIMIT 200",
    [roomId]
  );
  return res.rows.map((r) => r.data);
}

export async function dbInsertMessage(roomId: string, msg: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    "INSERT INTO messages (room_id, data) VALUES ($1, $2)",
    [roomId, JSON.stringify(msg)]
  );
}

export async function dbClearMessages(roomId: string): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM messages WHERE room_id = $1", [roomId]);
}

// ─── Analysis Results ────────────────────────────────

export async function dbGetAnalysisResults(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT id, data FROM analysis_results WHERE room_id = $1 ORDER BY created_at DESC LIMIT 50",
    [roomId]
  );
  return res.rows.map((r) => ({ dbId: r.id, ...r.data }));
}

export async function dbInsertAnalysisResult(roomId: string, item: any): Promise<number | null> {
  if (!pool) return null;
  const res = await pool.query(
    "INSERT INTO analysis_results (room_id, data) VALUES ($1, $2) RETURNING id",
    [roomId, JSON.stringify(item)]
  );
  return res.rows[0]?.id ?? null;
}

export async function dbDeleteAnalysisResult(roomId: string, dbId: number): Promise<void> {
  if (!pool) return;
  await pool.query(
    "DELETE FROM analysis_results WHERE id = $1 AND room_id = $2",
    [dbId, roomId]
  );
}
