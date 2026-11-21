import { Pool } from "pg";

// DATABASE_URL이 없으면 메모리 모드로 동작 (로컬 개발용)
let pool: Pool | null = process.env.DATABASE_URL
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
  try {
    await createTables(pool);
  } catch (e) {
    // DB에 연결할 수 없어도 서버 전체가 죽지 않도록 메모리 모드로 전환
    console.error("⚠️ DB 연결 실패 → 메모리 모드로 전환합니다 (데이터는 재시작 시 사라짐):", e);
    pool.end().catch(() => {});
    pool = null;
  }
}

async function createTables(pool: Pool) {
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

    CREATE TABLE IF NOT EXISTS canvas_images (
      id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, room_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ideas_room ON ideas(room_id);
    CREATE INDEX IF NOT EXISTS idx_sections_room ON sections(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_room ON analysis_results(room_id);
    CREATE INDEX IF NOT EXISTS idx_canvas_images_room ON canvas_images(room_id);

    -- 연구용 행동 로그 (누가 언제 무엇을 했는지)
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_name TEXT,
      type TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_events_room_time ON events(room_id, created_at);
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

// ─── Canvas Images ──────────────────────────────────

export async function dbGetCanvasImages(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT data FROM canvas_images WHERE room_id = $1 ORDER BY created_at ASC",
    [roomId]
  );
  return res.rows.map((r) => r.data);
}

export async function dbUpsertCanvasImage(roomId: string, img: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO canvas_images (id, room_id, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data`,
    [img.id, roomId, JSON.stringify(img)]
  );
}

export async function dbUpdateCanvasImage(roomId: string, id: string, patch: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE canvas_images SET data = data || $1::jsonb WHERE id = $2 AND room_id = $3`,
    [JSON.stringify(patch), id, roomId]
  );
}

export async function dbDeleteCanvasImage(roomId: string, id: string): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM canvas_images WHERE id = $1 AND room_id = $2", [id, roomId]);
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

export async function dbUpdateAnalysisResult(roomId: string, id: string, agentResult: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE analysis_results SET data = data || jsonb_build_object('agentResult', $1::jsonb) WHERE room_id = $2 AND data->>'id' = $3`,
    [JSON.stringify(agentResult), roomId, id]
  );
}

// dbId(정수 PK)로 업데이트 — 클라이언트 간 공통 식별자
export async function dbUpdateAnalysisResultById(roomId: string, dbId: number, agentResult: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE analysis_results SET data = data || jsonb_build_object('agentResult', $1::jsonb) WHERE id = $2 AND room_id = $3`,
    [JSON.stringify(agentResult), dbId, roomId]
  );
}

export async function dbDeleteAnalysisResult(roomId: string, dbId: number): Promise<void> {
  if (!pool) return;
  await pool.query(
    "DELETE FROM analysis_results WHERE id = $1 AND room_id = $2",
    [dbId, roomId]
  );
}

// ─── Events (연구용 행동 로그) ───────────────────────

export async function dbInsertEvent(roomId: string, userName: string | null, type: string, data: any): Promise<void> {
  if (!pool) return;
  await pool.query(
    "INSERT INTO events (room_id, user_name, type, data) VALUES ($1, $2, $3, $4)",
    [roomId, userName, type, JSON.stringify(data ?? {})]
  );
}

export async function dbGetEvents(roomId: string): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(
    "SELECT id, user_name, type, data, created_at FROM events WHERE room_id = $1 ORDER BY created_at ASC, id ASC",
    [roomId]
  );
  return res.rows.map((r) => ({ id: Number(r.id), user: r.user_name, type: r.type, data: r.data, at: r.created_at.toISOString() }));
}

// ─── 관리자용 조회 ───────────────────────────────────

/** 방 목록 + 테이블별 개수, 용량, 마지막 활동 */
export async function dbListRooms(): Promise<any[]> {
  if (!pool) return [];
  const res = await pool.query(`
    WITH all_rows AS (
      SELECT room_id, 'ideas' AS t, created_at, pg_column_size(data) AS sz FROM ideas
      UNION ALL SELECT room_id, 'sections', created_at, pg_column_size(data) FROM sections
      UNION ALL SELECT room_id, 'messages', created_at, pg_column_size(data) FROM messages
      UNION ALL SELECT room_id, 'analyses', created_at, pg_column_size(data) FROM analysis_results
      UNION ALL SELECT room_id, 'images', created_at, pg_column_size(data) FROM canvas_images
      UNION ALL SELECT room_id, 'events', created_at, pg_column_size(data) FROM events
    )
    SELECT room_id,
      count(*) FILTER (WHERE t = 'ideas')::int AS ideas,
      count(*) FILTER (WHERE t = 'sections')::int AS sections,
      count(*) FILTER (WHERE t = 'messages')::int AS messages,
      count(*) FILTER (WHERE t = 'analyses')::int AS analyses,
      count(*) FILTER (WHERE t = 'images')::int AS images,
      count(*) FILTER (WHERE t = 'events')::int AS events,
      sum(sz)::bigint AS bytes,
      max(created_at) AS last_activity
    FROM all_rows GROUP BY room_id ORDER BY max(created_at) DESC
  `);
  return res.rows.map((r) => ({
    roomId: r.room_id, ideas: r.ideas, sections: r.sections, messages: r.messages,
    analyses: r.analyses, images: r.images, events: r.events,
    bytes: Number(r.bytes), lastActivity: r.last_activity?.toISOString() ?? null,
  }));
}

export async function dbStorage(): Promise<{ databaseBytes: number; tables: { name: string; bytes: number }[] } | null> {
  if (!pool) return null;
  const db = await pool.query("SELECT pg_database_size(current_database())::bigint AS b");
  const t = await pool.query(`
    SELECT relname AS name, pg_total_relation_size(relid)::bigint AS b
    FROM pg_catalog.pg_statio_user_tables ORDER BY b DESC
  `);
  return { databaseBytes: Number(db.rows[0].b), tables: t.rows.map((r) => ({ name: r.name, bytes: Number(r.b) })) };
}

/** 연구·백업용 전체 데이터 (화면용 조회와 달리 개수 제한 없음) */
export async function dbGetRoomFull(roomId: string) {
  if (!pool) return null;
  const q = (sql: string) => pool!.query(sql, [roomId]).then((r) => r.rows);
  const [ideas, sections, messages, analyses, images] = await Promise.all([
    q("SELECT data FROM ideas WHERE room_id = $1 ORDER BY created_at ASC"),
    q("SELECT data FROM sections WHERE room_id = $1 ORDER BY created_at ASC"),
    q("SELECT data FROM messages WHERE room_id = $1 ORDER BY created_at ASC, id ASC"),
    q("SELECT id, data FROM analysis_results WHERE room_id = $1 ORDER BY created_at ASC"),
    q("SELECT data FROM canvas_images WHERE room_id = $1 ORDER BY created_at ASC"),
  ]);
  return {
    ideas: ideas.map((r) => r.data),
    sections: sections.map((r) => r.data),
    messages: messages.map((r) => r.data),
    analysisResults: analyses.map((r) => ({ dbId: r.id, ...r.data })),
    canvasImages: images.map((r) => r.data),
  };
}

export async function dbDeleteRoom(roomId: string): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of ["ideas", "sections", "messages", "analysis_results", "canvas_images", "events"]) {
      await client.query(`DELETE FROM ${t} WHERE room_id = $1`, [roomId]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** 백업 JSON을 빈 방에 복원 (한 트랜잭션) */
export async function dbRestoreRoom(roomId: string, backup: any): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const idea of backup.ideas ?? []) {
      await client.query("INSERT INTO ideas (id, room_id, data) VALUES ($1, $2, $3) ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data", [idea.id, roomId, JSON.stringify(idea)]);
    }
    for (const s of backup.sections ?? []) {
      await client.query("INSERT INTO sections (id, room_id, data) VALUES ($1, $2, $3) ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data", [s.id, roomId, JSON.stringify(s)]);
    }
    for (const m of backup.messages ?? []) {
      await client.query("INSERT INTO messages (room_id, data) VALUES ($1, $2)", [roomId, JSON.stringify(m)]);
    }
    for (const a of backup.analysisResults ?? []) {
      const { dbId: _old, ...rest } = a;
      await client.query("INSERT INTO analysis_results (room_id, data) VALUES ($1, $2)", [roomId, JSON.stringify(rest)]);
    }
    for (const img of backup.canvasImages ?? []) {
      await client.query("INSERT INTO canvas_images (id, room_id, data) VALUES ($1, $2, $3) ON CONFLICT (id, room_id) DO UPDATE SET data = EXCLUDED.data", [img.id, roomId, JSON.stringify(img)]);
    }
    for (const ev of backup.events ?? []) {
      await client.query("INSERT INTO events (room_id, user_name, type, data, created_at) VALUES ($1, $2, $3, $4, $5)", [roomId, ev.user ?? null, ev.type, JSON.stringify(ev.data ?? {}), ev.at ?? new Date().toISOString()]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
