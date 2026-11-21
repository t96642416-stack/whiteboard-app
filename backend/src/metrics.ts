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

// ── 아이디어 구체화 ─────────────────────────────────
// 행동 로그(idea_add / idea_edit)로 카드별 버전 이력을 복원하고, AI 분석 결과가 나온 시점과 연결한다.

interface Version { at: number; title: string; content: string; category: string }

const CATEGORY_RANK: Record<string, number> = { brainstorm: 0, other: 0, ai: 0, candidate: 1, review: 2 };
const verText = (v: { title?: string; content?: string }) => `${v.title ?? ""}\n${v.content ?? ""}`.trim();
const verLen = (v: { title?: string; content?: string }) => `${v.title ?? ""}${v.content ?? ""}`.trim().length;

/** 구체 요소 수: 숫자 표현(수량·날짜·금액 등) + 목록 항목(-, •, 1. 로 시작하는 줄) */
export function specificity(text: string): number {
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).length;
  const listItems = (text.match(/^\s*(?:[-•*·▪]|\d+[.)])\s+/gm) ?? []).length;
  return numbers + listItems;
}

// ── 삭제된 아이디어 복원 ──────────────────────────────
// idea_delete 로그(삭제 당시 내용) + idea_add / idea_edit 이력으로 삭제된 카드를 되살린다. 행동 로그 기록 이후 삭제분만 가능.
export interface DeletedInfo { deletedAt: string; deletedBy: string | null }

export function deletedIdeas(room: RoomData): (any & { _deleted: DeletedInfo })[] {
  const current = new Set(room.ideas.map((i) => i.id));
  const last = new Map<string, any>();      // ideaId → 마지막으로 알려진 상태
  const deleted = new Map<string, any>();
  for (const e of room.events) {
    const d = e.data ?? {};
    if (!d.ideaId) continue;
    if (e.type === "idea_add") {
      last.set(d.ideaId, { id: d.ideaId, title: d.title, content: d.content, category: d.category, author: e.user, createdAt: e.at,
        analysisSnapshot: d.fromAI ? { agentType: d.agentType } : undefined, attachmentsCount: d.attachments ?? 0 });
      deleted.delete(d.ideaId); // 삭제 후 되살린 경우(되돌리기)
    } else if (e.type === "idea_edit") {
      const prev = last.get(d.ideaId) ?? { id: d.ideaId, author: d.author };
      last.set(d.ideaId, { ...prev, title: d.after?.title ?? prev.title, content: d.after?.content ?? prev.content, category: d.after?.category ?? prev.category });
    } else if (e.type === "idea_delete") {
      const prev = last.get(d.ideaId) ?? { id: d.ideaId };
      deleted.set(d.ideaId, {
        ...prev,
        id: d.ideaId,
        title: d.title ?? prev.title ?? "",
        content: d.content ?? prev.content ?? "",
        author: d.author ?? prev.author ?? null,
        createdAt: d.createdAt ?? prev.createdAt ?? null,
        analysisSnapshot: (d.fromAI ?? !!prev.analysisSnapshot) ? (prev.analysisSnapshot ?? { agentType: undefined }) : undefined,
        _deleted: { deletedAt: e.at, deletedBy: e.user ?? null },
      });
    }
  }
  return [...deleted.values()].filter((i) => !current.has(i.id));
}

export interface IdeaTrace {
  ideaId: string; author: string; tracked: boolean; analyzed: boolean; firstAnalyzedAt: string | null;
  edits: number; editsAfterAnalysis: number; editedWithinWindow: boolean;
  first: Version | null; atAnalysis: Version | null; final: Version;
}

export function traceIdeas(room: RoomData, windowMin: number, includeDeleted = false): (IdeaTrace & { deleted: DeletedInfo | null })[] {
  const human = [...room.ideas, ...(includeDeleted ? deletedIdeas(room) : [])].filter((i) => !isAiIdea(i));
  const history = new Map<string, Version[]>();
  const edits = new Map<string, number[]>();
  // 분석 요청 → 같은 사용자의 다음 완료 이벤트와 짝지어 "결과를 받은 시점"을 구함
  const pending = new Map<string, any[]>();
  const analyses: { at: number; ideaIds: Set<string> }[] = [];

  for (const e of room.events) {
    const t = ts(e.at); if (t == null) continue;
    const d = e.data ?? {};
    if (e.type === "idea_add" && d.ideaId && !d.fromAI) {
      history.set(d.ideaId, [{ at: t, title: d.title ?? "", content: d.content ?? "", category: d.category ?? "brainstorm" }]);
    } else if (e.type === "idea_edit" && d.ideaId) {
      const list = history.get(d.ideaId) ?? [];
      if (list.length === 0 && d.before) list.push({ at: t - 1, title: d.before.title ?? "", content: d.before.content ?? "", category: d.before.category ?? "brainstorm" });
      const prev = list[list.length - 1];
      list.push({ at: t, title: d.after?.title ?? prev?.title ?? "", content: d.after?.content ?? prev?.content ?? "", category: d.after?.category ?? prev?.category ?? "brainstorm" });
      history.set(d.ideaId, list);
      edits.set(d.ideaId, [...(edits.get(d.ideaId) ?? []), t]);
    } else if (e.type === "analysis_request") {
      const key = e.user ?? "";
      pending.set(key, [...(pending.get(key) ?? []), d]);
    } else if (e.type === "analysis_done" || e.type === "analysis_error") {
      const q = pending.get(e.user ?? "") ?? [];
      const req = q.shift();
      if (req && e.type === "analysis_done" && Array.isArray(req.ideaIds)) analyses.push({ at: t, ideaIds: new Set(req.ideaIds) });
    }
  }

  const w = windowMin * 60000;
  return human.map((idea) => {
    const hist = history.get(idea.id) ?? [];
    const final: Version = { at: idea._deleted ? Date.parse(idea._deleted.deletedAt) : Date.now(), title: idea.title ?? "", content: idea.content ?? "", category: idea.category ?? "brainstorm" };
    const myAnalyses = analyses.filter((a) => a.ideaIds.has(idea.id)).map((a) => a.at).sort((a, b) => a - b);
    const firstAn = myAnalyses[0] ?? null;
    const editTimes = edits.get(idea.id) ?? [];
    const atAnalysis = firstAn != null ? [...hist].reverse().find((v) => v.at <= firstAn) ?? null : null;
    return {
      ideaId: idea.id,
      author: idea.author,
      deleted: idea._deleted ?? null,
      tracked: hist.length > 0,
      analyzed: firstAn != null,
      firstAnalyzedAt: firstAn != null ? new Date(firstAn).toISOString() : null,
      edits: editTimes.length,
      editsAfterAnalysis: firstAn != null ? editTimes.filter((t) => t > firstAn).length : 0,
      editedWithinWindow: myAnalyses.some((a) => editTimes.some((t) => t > a && t <= a + w)),
      first: hist[0] ?? null,
      atAnalysis,
      final,
    };
  });
}

function concretizationGroup(list: IdeaTrace[]) {
  const n = list.length;
  const avg = (f: (x: IdeaTrace) => number) => (n ? round(list.reduce((s, x) => s + f(x), 0) / n) : null);
  return {
    n,
    editedShare: n ? round(list.filter((x) => x.edits > 0).length / n, 3) : null,
    avgEdits: avg((x) => x.edits),
    avgLengthChange: avg((x) => verLen(x.final) - verLen(x.first!)),
    avgSpecificityChange: avg((x) => specificity(verText(x.final)) - specificity(verText(x.first!))),
    progressedShare: n ? round(list.filter((x) => (CATEGORY_RANK[x.final.category] ?? 0) > (CATEGORY_RANK[x.first!.category] ?? 0)).length / n, 3) : null,
  };
}

export function computeConcretization(room: RoomData, windowMin: number) {
  const traces = traceIdeas(room, windowMin);
  const tracked = traces.filter((t) => t.tracked);
  const analyzed = tracked.filter((t) => t.analyzed);
  const notAnalyzed = tracked.filter((t) => !t.analyzed);
  const sinceAnalysis = analyzed.filter((t) => t.atAnalysis);
  const n = sinceAnalysis.length;
  return {
    humanIdeas: traces.length,
    trackedIdeas: tracked.length,
    untrackedIdeas: traces.length - tracked.length,
    totalEdits: tracked.reduce((s, t) => s + t.edits, 0),
    analyzed: {
      ...concretizationGroup(analyzed),
      editedAfterAnalysisShare: analyzed.length ? round(analyzed.filter((t) => t.editsAfterAnalysis > 0).length / analyzed.length, 3) : null,
      editedWithinWindowShare: analyzed.length ? round(analyzed.filter((t) => t.editedWithinWindow).length / analyzed.length, 3) : null,
      // 분석 받은 시점의 버전 → 현재 버전 변화 (AI 이후 얼마나 다듬어졌는지)
      avgLengthChangeSinceAnalysis: n ? round(sinceAnalysis.reduce((s, t) => s + verLen(t.final) - verLen(t.atAnalysis!), 0) / n) : null,
      avgSpecificityChangeSinceAnalysis: n ? round(sinceAnalysis.reduce((s, t) => s + specificity(verText(t.final)) - specificity(verText(t.atAnalysis!)), 0) / n) : null,
    },
    notAnalyzed: concretizationGroup(notAnalyzed),
    windowMin,
  };
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
  let editedIdeas = 0, analysisErrors = 0;
  for (const e of events) {
    const x = u(e.user);
    const t = ts(e.at);
    if (e.type === "idea_edit") { editedIdeas++; if (x) x.edits++; }
    // 삭제는 아래에서 "최종적으로 삭제된 카드" 기준으로 셈 (삭제 후 되돌린 카드 제외)
    if (e.type === "ai_chat" && x) x.aiChats++;
    if (e.type === "analysis_error") analysisErrors++;
    if (e.type === "join" && x && t) { if (!openSessions.has(x.name)) openSessions.set(x.name, t); }
    if (e.type === "leave" && x && t) {
      const s = openSessions.get(x.name);
      if (s != null) { x.activeMs += t - s; openSessions.delete(x.name); }
    }
  }
  if (end != null) for (const [name, s] of openSessions) { const x = users.get(name); if (x) x.activeMs += end - s; }
  const finallyDeleted = deletedIdeas(room);
  {
    for (const d of finallyDeleted) { const x = u(d._deleted.deletedBy); if (x) x.deletes++; }
  }
  const deletedCount = finallyDeleted.length;

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
      deletedIdeas: deletedCount,
      eventCount: events.length,
      eventLogSince: firstEvent,
    },
    participants,
    timeline: { bucketMin, buckets: timeline },
    analyses: analyses.map(({ t: _t, ...rest }) => rest),
    agentEffects,
    concretization: computeConcretization(room, opts.windowMin),
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

export const CSV_KINDS = ["ideas", "comments", "messages", "analyses", "events", "participants", "concretization", "rating-sheet", "rating-key"] as const;

// 방 ID로 시드를 고정한 셔플 — 평가지와 정답 키가 항상 같은 순서로 나오도록
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 사람 평가용 항목: 내용이 바뀐 카드는 첫 버전·최종 버전 두 개, 나머지는 최종 버전 하나. 순서는 섞고 작성자·버전은 가림 */
function ratingItems(room: RoomData, opts: MetricsOptions, roomId: string) {
  const items: { ideaId: string; version: "first" | "final"; v: Version; t: IdeaTrace }[] = [];
  for (const t of traceIdeas(room, opts.windowMin)) {
    const changed = t.first && verText(t.first) !== verText(t.final);
    if (changed) items.push({ ideaId: t.ideaId, version: "first", v: t.first!, t });
    items.push({ ideaId: t.ideaId, version: "final", v: t.final, t });
  }
  // 같은 카드의 두 버전이 나란히 나오면 평가자가 비교하며 채점하게 되므로 떨어뜨림
  const shuffled = seededShuffle(items, roomId);
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].ideaId !== shuffled[i - 1].ideaId) continue;
    const j = shuffled.findIndex((x, k) => k > i && x.ideaId !== shuffled[i].ideaId && shuffled[k - 1]?.ideaId !== shuffled[i].ideaId && shuffled[k + 1]?.ideaId !== shuffled[i].ideaId);
    const k = j >= 0 ? j : shuffled.findIndex((x, k) => k < i - 1 && x.ideaId !== shuffled[i].ideaId && shuffled[k - 1]?.ideaId !== shuffled[i].ideaId && shuffled[k + 1]?.ideaId !== shuffled[i].ideaId);
    if (k >= 0) [shuffled[i], shuffled[k]] = [shuffled[k], shuffled[i]];
  }
  return shuffled.map((x, i) => ({ ...x, itemId: `R${String(i + 1).padStart(3, "0")}` }));
}
export type CsvKind = typeof CSV_KINDS[number];

export function buildCsv(kind: CsvKind, room: RoomData, opts: MetricsOptions, roomId = ""): string {
  const nameOf = buildNameMap(room, opts.anon);
  switch (kind) {
    case "concretization":
      return csv(traceIdeas(room, opts.windowMin, true).map((t) => ({
        ideaId: t.ideaId, status: t.deleted ? "deleted" : "active", deletedAt: t.deleted?.deletedAt ?? "",
        author: nameOf(t.author), tracked: t.tracked, analyzedByAI: t.analyzed, firstAnalyzedAt: t.firstAnalyzedAt ?? "",
        edits: t.edits, editsAfterAnalysis: t.editsAfterAnalysis, editedWithinWindow: t.editedWithinWindow,
        firstLength: t.first ? verLen(t.first) : "", lengthAtAnalysis: t.atAnalysis ? verLen(t.atAnalysis) : "", finalLength: verLen(t.final),
        firstSpecificity: t.first ? specificity(verText(t.first)) : "", specificityAtAnalysis: t.atAnalysis ? specificity(verText(t.atAnalysis)) : "",
        finalSpecificity: specificity(verText(t.final)),
        firstCategory: t.first?.category ?? "", finalCategory: t.final.category,
        firstText: t.first ? verText(t.first) : "", finalText: verText(t.final),
      })), ["ideaId", "status", "deletedAt", "author", "tracked", "analyzedByAI", "firstAnalyzedAt", "edits", "editsAfterAnalysis", "editedWithinWindow",
        "firstLength", "lengthAtAnalysis", "finalLength", "firstSpecificity", "specificityAtAnalysis", "finalSpecificity",
        "firstCategory", "finalCategory", "firstText", "finalText"]);
    case "rating-sheet":
      return csv(ratingItems(room, opts, roomId).map((x) => ({
        itemId: x.itemId, title: x.v.title, content: x.v.content, "구체성(1-5)": "", "메모": "",
      })), ["itemId", "title", "content", "구체성(1-5)", "메모"]);
    case "rating-key":
      return csv(ratingItems(room, opts, roomId).map((x) => ({
        itemId: x.itemId, ideaId: x.ideaId, version: x.version, analyzedByAI: x.t.analyzed, author: nameOf(x.t.author), edits: x.t.edits,
      })), ["itemId", "ideaId", "version", "analyzedByAI", "author", "edits"]);
    case "ideas": {
      const rows = [...room.ideas, ...deletedIdeas(room)].map((i: any) => ({
        id: i.id,
        status: i._deleted ? "deleted" : "active",
        createdAt: i.createdAt ?? "", author: nameOf(i.author),
        source: isAiIdea(i) ? "ai" : "human", agentType: i.analysisSnapshot?.agentType ?? "",
        category: i.category ?? "brainstorm", title: i.title ?? "", content: i.content ?? "", length: textLen(i),
        attachments: i._deleted ? (i.attachmentsCount ?? "") : (i.attachments ?? []).length,
        comments: i._deleted ? "" : (i.comments ?? []).length,
        deletedAt: i._deleted?.deletedAt ?? "",
        deletedBy: i._deleted ? nameOf(i._deleted.deletedBy) : "",
        deletedByAuthor: i._deleted ? (i._deleted.deletedBy === i.author) : "",
      }));
      rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return csv(rows, ["id", "status", "createdAt", "author", "source", "agentType", "category", "title", "content", "length",
        "attachments", "comments", "deletedAt", "deletedBy", "deletedByAuthor"]);
    }
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
      const cols = ["name", "humanIdeas", "aiCardsAdded", "avgIdeaLength", "comments", "commentsOnOthers", "aiChats", "analysisRequests", "edits", "deletes", "activeMinutes"];
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
