import { AGENT_OPTIONS } from "../types";

export const fmtBytes = (b: number | null | undefined) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

export const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtAgo = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return "—";
  const m = Math.floor((now - Date.parse(iso)) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

export const fmtPct = (r: number) => `${Math.round(r * 1000) / 10}%`;

export const agentLabel = (t: string | null | undefined) =>
  AGENT_OPTIONS.find((a) => a.type === t)?.name ?? (t === "general" || !t ? "기본 분석" : t);

export const CATEGORY_LABELS: Record<string, string> = {
  brainstorm: "브레인스토밍", ai: "AI 피드백", review: "최종 검토", candidate: "후보 아이디어", other: "기타",
};
