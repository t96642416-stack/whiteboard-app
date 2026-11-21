import { EventRow } from "./events";

// 연구용 지표 계산. 입력은 한 방의 전체 데이터, 출력은 관리자 화면/CSV에 그대로 쓰는 값.

export interface RoomData {
  ideas: any[];
  sections: any[];
  messages: any[];
  analysisResults: any[];
  canvasImages: any[];
  events: EventRow[];
}

export interface MetricsOptions {
  windowMin: number; // AI 분석 전후 비교 구간(분)
  anon: boolean;     // 이름 → P1, P2 …
}

const ts = (s: any): number | null => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : null;
};
const textLen = (idea: any) => `${idea.title ?? ""}${idea.content ?? ""}`.trim().length;
const isAiIdea = (idea: any) => !!idea.analysisSnapshot;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function gini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (const a of values) for (const b of values) sum += Math.abs(a - b);
  return sum / (2 * n * n * mean);
}

/** 처음 등장한 순서대로 P1, P2 … 를 붙인다 (anon=false면 원래 이름) */
export function buildNameMap(room: RoomData, anon: boolean): (name: string | null | undefined) => string {
  const first = new Map<string, number>();
  const see = (name: any, t: number | null) => {
    if (!name || typeof name !== "string") return;
    const prev = first.get(name);
    const tt = t ?? Number.MAX_SAFE_INTEGER;
    if (prev === undefined || tt < prev) first.set(name, tt);
  };
  for (const e of room.events) see(e.user, ts(e.at));
  for (const i of room.ideas) {
    see(i.author, ts(i.createdAt));
    for (const c of i.comments ?? []) see(c.author, ts(c.createdAt));
  }
  for (const m of room.messages) see(m.userName, ts(m.timestamp));
  for (const a of room.analysisResults) see(a.requester, ts(a.timestamp));

  const ordered = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  const map = new Map(ordered.map((n, i) => [n, `P${i + 1}`]));
  return (name) => {
    if (!name) return "";
    return anon ? map.get(name) ?? "P?" : name;
  };
}

function pickBucket(durationMin: number): number {
  for (const b of [1, 2, 5, 10, 15, 30, 60, 120, 240, 720, 1440]) if (durationMin / b <= 60) return b;
  return 1440;
}

export function computeMetrics(room: RoomData, opts: MetricsOptions) {
  const nameOf = buildNameMap(room, opts.anon);
  const humanIdeas = room.ideas.filter((i) => !isAiIdea(i));
  const aiIdeas = room.ideas.filter(isAiIdea);
  const events = room.events;

  // ── 기간
  const times: number[] = [];
  for (const i of room.ideas) { const t = ts(i.createdAt); if (t) times.push(t); }
  for (const m of room.messages) { const t = ts(m.timestamp); if (t) times.push(t); }
  for (const a of room.analysisResults) { const t = ts(a.timestamp); if (t) times.push(t); }
  for (const e of events) { const t = ts(e.at); if (t) times.push(t); }
  const start = times.length ? Math.min(...times) : null;
  const end = times.length ? Math.max(...times) : null;
  const durationMin = start != null && end != null ? (end - start) / 60000 : 0;

  // ── 참가자별
  type U = { name: string; humanIdeas: number; aiCards: number; lenSum: number; comments: number; commentsOnOthers: number;
    chats: number; aiChats: number; analysisRequests: number; edits: number; deletes: number; activeMs: number };
  const users = new Map<string, U>();
  const u = (raw: any): U | null => {
    if (!raw) return null;
    const name = nameOf(raw);
    if (!users.has(name)) users.set(name, { name, humanIdeas: 0, aiCards: 0, lenSum: 0, comments: 0, commentsOnOthers: 0,
      chats: 0, aiChats: 0, analysisRequests: 0, edits: 0, deletes: 0, activeMs: 0 });
    return users.get(name)!;
  };

  let comments = 0, crossComments = 0, attachments = 0;
  const categoryCounts: Record<string, number> = {};
  for (const i of room.ideas) {
    const owner = u(i.author);
    if (isAiIdea(i)) { if (owner) owner.aiCards++; }
    else {
      if (owner) { owner.humanIdeas++; owner.lenSum += textLen(i); }
      const cat = i.category ?? "brainstorm";
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
    attachments += (i.attachments ?? []).length;
    for (const c of i.comments ?? []) {
      comments++;
      const cu = u(c.author);
      if (cu) cu.comments++;
      if (c.author && c.author !== i.author) { crossComments++; if (cu) cu.commentsOnOthers++; }
    }
  }
  for (const m of room.messages) { const x = u(m.userName); if (x) x.chats++; }
  for (const a of room.analysisResults) { const x = u(a.requester); if (x) x.analysisRequests++; }

  // 이벤트 기반 (이벤트 로그가 쌓인 이후 데이터만)
  const openSessions = new Map<string, number>();
  let deletedIdeas = 0, editedIdeas = 0, analysisErrors = 0;
  for (const e of events) {
    const x = u(e.user);
    const t = ts(e.at);
    if (e.type === "idea_edit") { editedIdeas++; if (x) x.edits++; }
    if (e.type === "idea_delete") { deletedIdeas++; if (x) x.deletes++; }
    if (e.type === "ai_chat" && x) x.aiChats++;
    if (e.type === "analysis_error") analysisErrors++;
    if (e.type === "join" && x && t) { if (!openSessions.has(x.name)) openSessions.set(x.name, t); }
    if (e.type === "leave" && x && t) {
      const s = openSessions.get(x.name);
      if (s != null) { x.activeMs += t - s; openSessions.delete(x.name); }
    }
  }
  if (end != null) for (const [name, s] of openSessions) { const x = users.get(name); if (x) x.activeMs += end - s; }

  const participants = [...users.values()].map((x) => ({
    name: x.name,
    humanIdeas: x.humanIdeas,
    aiCardsAdded: x.aiCards,
    avgIdeaLength: x.humanIdeas ? round(x.lenSum / x.humanIdeas, 1) : 0,
    comments: x.comments,
    commentsOnOthers: x.commentsOnOthers,
    chats: x.chats,
    aiChats: x.aiChats,
    analysisRequests: x.analysisRequests,
    edits: x.edits,
    deletes: x.deletes,
    activeMinutes: events.length ? round(x.activeMs / 60000, 1) : null,
  })).sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));

  // ── 타임라인 (사람 아이디어 vs AI 카드)
  const bucketMin = pickBucket(Math.max(1, durationMin));
  const nBuckets = start != null ? Math.floor(durationMin / bucketMin) + 1 : 0;
  const timeline = Array.from({ length: nBuckets }, (_, k) => ({ startMin: k * bucketMin, human: 0, ai: 0 }));
  if (start != null) {
    for (const i of room.ideas) {
      const t = ts(i.createdAt); if (t == null) continue;
      const k = Math.min(nBuckets - 1, Math.floor((t - start) / 60000 / bucketMin));
      if (k >= 0) (isAiIdea(i) ? timeline[k].ai++ : timeline[k].human++);
    }
  }
  const analyses = room.analysisResults
    .map((a) => ({ t: ts(a.timestamp), agentType: a.agentType ?? "general", requester: nameOf(a.requester) }))
    .filter((a) => a.t != null)
    .sort((a, b) => a.t! - b.t!)
    .map((a) => ({ atMin: start != null ? round((a.t! - start) / 60000, 1) : 0, agentType: a.agentType, requester: a.requester, t: a.t! }));

  // ── AI 분석 전후 비교: 분석 시점 기준 앞뒤 windowMin 분 동안 사람이 낸 아이디어 수
  const w = opts.windowMin * 60000;
  const humanTimes = humanIdeas.map((i) => ts(i.createdAt)).filter((t): t is number => t != null);
  const byAgent = new Map<string, { n: number; before: number; after: number }>();
  for (const a of analyses) {
    const before = humanTimes.filter((t) => t >= a.t - w && t < a.t).length;
    const after = humanTimes.filter((t) => t >= a.t && t < a.t + w).length;
    const g = byAgent.get(a.agentType) ?? { n: 0, before: 0, after: 0 };
    g.n++; g.before += before; g.after += after;
    byAgent.set(a.agentType, g);
  }
  const adoptedByAgent: Record<string, number> = {};
  for (const i of aiIdeas) {
    const k = i.analysisSnapshot?.agentType ?? "unknown";
    adoptedByAgent[k] = (adoptedByAgent[k] ?? 0) + 1;
  }
  const agentEffects = [...new Set([...byAgent.keys(), ...Object.keys(adoptedByAgent)])].map((agentType) => {
    const g = byAgent.get(agentType) ?? { n: 0, before: 0, after: 0 };
    return {
      agentType,
      requests: g.n,
      avgHumanIdeasBefore: g.n ? round(g.before / g.n) : null,
      avgHumanIdeasAfter: g.n ? round(g.after / g.n) : null,
      avgChange: g.n ? round((g.after - g.before) / g.n) : null,
      aiCardsAdopted: adoptedByAgent[agentType] ?? 0,
    };
  }).sort((a, b) => b.requests - a.requests);

  const firstEvent = events.length ? events[0].at : null;

  return {
    summary: {
      participants: participants.length,
      totalIdeas: room.ideas.length,
      humanIdeas: humanIdeas.length,
      aiCards: aiIdeas.length,
      aiShare: room.ideas.length ? round(aiIdeas.length / room.ideas.length, 3) : 0,
      avgIdeaLength: humanIdeas.length ? round(humanIdeas.reduce((s, i) => s + textLen(i), 0) / humanIdeas.length, 1) : 0,
      attachments,
      comments,
      crossCommentShare: comments ? round(crossComments / comments, 3) : 0,
      chats: room.messages.length,
      analyses: room.analysisResults.length,
      analysisErrors,
      giniHumanIdeas: round(gini(participants.map((p) => p.humanIdeas)), 3),
      categoryCounts,
      sections: room.sections.length,
      start: start ? new Date(start).toISOString() : null,
      end: end ? new Date(end).toISOString() : null,
      durationMin: round(durationMin, 1),
      humanIdeasPerMin: durationMin > 0 ? round(humanIdeas.length / durationMin, 3) : 0,
      editedIdeas,
      deletedIdeas,
      eventCount: events.length,
      eventLogSince: firstEvent,
    },
    participants,
    timeline: { bucketMin, buckets: timeline },
    analyses: analyses.map(({ t: _t, ...rest }) => rest),
    agentEffects,
    windowMin: opts.windowMin,
  };
}

// ── CSV ─────────────────────────────────────────────

function csv(rows: Record<string, any>[], columns: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM: 엑셀에서 한글이 깨지지 않도록
  return "﻿" + [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n");
}

export const CSV_KINDS = ["ideas", "comments", "messages", "analyses", "events", "participants"] as const;
export type CsvKind = typeof CSV_KINDS[number];

export function buildCsv(kind: CsvKind, room: RoomData, opts: MetricsOptions): string {
  const nameOf = buildNameMap(room, opts.anon);
  switch (kind) {
    case "ideas":
      return csv(room.ideas.map((i) => ({
        id: i.id, createdAt: i.createdAt, author: nameOf(i.author),
        source: isAiIdea(i) ? "ai" : "human", agentType: i.analysisSnapshot?.agentType ?? "",
        category: i.category ?? "brainstorm", title: i.title, content: i.content, length: textLen(i),
        attachments: (i.attachments ?? []).length, comments: (i.comments ?? []).length,
      })), ["id", "createdAt", "author", "source", "agentType", "category", "title", "content", "length", "attachments", "comments"]);
    case "comments":
      return csv(room.ideas.flatMap((i) => (i.comments ?? []).map((c: any) => ({
        ideaId: i.id, ideaAuthor: nameOf(i.author), createdAt: c.createdAt, author: nameOf(c.author),
        onOthers: c.author !== i.author, text: c.text,
      }))), ["ideaId", "ideaAuthor", "createdAt", "author", "onOthers", "text"]);
    case "messages":
      return csv(room.messages.map((m) => ({
        timestamp: m.timestamp, user: nameOf(m.userName), message: m.message, hasImage: !!m.imageUrl,
      })), ["timestamp", "user", "message", "hasImage"]);
    case "analyses":
      return csv(room.analysisResults.map((a) => ({
        dbId: a.dbId, timestamp: a.timestamp, requester: nameOf(a.requester), agentType: a.agentType ?? "general",
      })), ["dbId", "timestamp", "requester", "agentType"]);
    case "events":
      return csv(room.events.map((e) => ({
        at: e.at, user: nameOf(e.user), type: e.type, data: anonymizeEventData(e.data, nameOf, opts.anon),
      })), ["at", "user", "type", "data"]);
    case "participants": {
      const m = computeMetrics(room, opts);
      const cols = ["name", "humanIdeas", "aiCardsAdded", "avgIdeaLength", "comments", "commentsOnOthers", "chats", "aiChats", "analysisRequests", "edits", "deletes", "activeMinutes"];
      return csv(m.participants, cols);
    }
  }
}

function anonymizeEventData(data: any, nameOf: (n: any) => string, anon: boolean): any {
  if (!anon || !data || typeof data !== "object") return data;
  const out = { ...data };
  for (const k of ["author", "ideaAuthor", "requester", "userName"]) if (typeof out[k] === "string") out[k] = nameOf(out[k]);
  return out;
}
