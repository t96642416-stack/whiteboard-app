import React, { useEffect, useId, useRef, useState } from "react";

const TIP_W = 256;

// 지표 이름 옆 ⓘ 버튼 — 누르면 설명이 뜨고, 바깥을 누르거나 Esc로 닫힘 (모바일에서도 동작)

export interface TipContent {
  what: string;      // 무엇인지
  how?: string;      // 어떻게 계산하는지
  read?: string;     // 어떻게 읽는지 / 주의점
}

const InfoTip: React.FC<{ tip: TipContent; label: string }> = ({ tip, label }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true); // 표 가로 스크롤 등 어디서든 스크롤하면 닫음
    return () => {
      document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button ref={btnRef} type="button" onClick={(e) => {
        e.stopPropagation();
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
          const w = Math.min(TIP_W, window.innerWidth - 16);
          setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - w - 8)) });
        }
        setOpen((v) => !v);
      }}
        aria-label={`${label} 설명`} aria-expanded={open} aria-controls={id}
        className={`ml-1 w-4 h-4 rounded-full text-[10px] leading-none font-bold inline-flex items-center justify-center transition-colors
          ${open ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
        i
      </button>
      {open && (
        <span id={id} role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.min(TIP_W, window.innerWidth - 16) }}
          className={`z-50 bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-left font-normal normal-case tracking-normal whitespace-normal`}>
          <span className="block text-xs font-semibold text-gray-900 mb-1">{label}</span>
          <span className="block text-xs text-gray-700 leading-relaxed">{tip.what}</span>
          {tip.how && <span className="block text-xs text-gray-500 leading-relaxed mt-1.5"><b className="font-semibold text-gray-600">계산</b> · {tip.how}</span>}
          {tip.read && <span className="block text-xs text-gray-500 leading-relaxed mt-1.5"><b className="font-semibold text-gray-600">읽는 법</b> · {tip.read}</span>}
        </span>
      )}
    </span>
  );
};

export default InfoTip;

// ── 지표 설명 모음
export const TIPS: Record<string, TipContent> = {
  participants: {
    what: "이 방에서 아이디어·댓글·분석 요청 등 활동 기록이 있는 사람 수입니다.",
    read: "입장할 때 쓴 이름으로 구분합니다. 같은 사람이 다른 이름으로 들어오면 두 명으로 잡힙니다.",
  },
  fluency: {
    what: "유창성(Fluency) — 참가자가 직접 쓴 아이디어 카드의 개수입니다. 아이디어 발상 연구에서 가장 기본이 되는 양적 지표입니다.",
    how: "AI 결과에서 가져온 카드는 빼고 셉니다. 분당 개수 = 아이디어 수 ÷ 진행 시간.",
    read: "삭제된 카드는 포함되지 않습니다. 양만 보여 주므로 질(독창성 등)은 따로 평가해야 합니다.",
  },
  aiShare: {
    what: "AI 의존도 — 보드의 전체 카드 중 AI 분석 결과에서 가져온 카드의 비율입니다.",
    how: "AI 카드 수 ÷ 전체 카드 수.",
    read: "높을수록 팀이 AI 제안을 결과물로 많이 채택했다는 뜻입니다. 좋고 나쁨이 아니라 AI 활용 방식의 차이로 해석하세요.",
  },
  elaboration: {
    what: "정교성(Elaboration) — 아이디어를 얼마나 자세히 썼는지를 글자 수로 대신 본 값입니다.",
    how: "사람 아이디어의 (제목 + 본문) 글자 수 평균. 공백 포함.",
    read: "길다고 꼭 좋은 아이디어는 아닙니다. 정교성의 대략적인 대리 지표로만 쓰세요.",
  },
  gini: {
    what: "참여 균등도 — 아이디어가 몇 사람에게 쏠렸는지를 0~1로 나타낸 지니계수입니다.",
    how: "참가자별 사람 아이디어 수로 계산합니다.",
    read: "0 = 모두 같은 개수, 1에 가까울수록 소수가 대부분을 냄. 참가자가 적으면(2~3명) 값이 크게 흔들립니다.",
  },
  comments: {
    what: "카드에 달린 댓글 수와, 그중 남이 쓴 카드에 단 댓글의 비율입니다.",
    read: "타인 댓글 비율이 높을수록 서로의 아이디어에 반응하며 상호작용했다는 신호입니다.",
  },
  analyses: {
    what: "AI 분석을 요청해서 결과가 나온 횟수입니다. 실패한 요청은 따로 표시합니다.",
    read: "분석 내역에서 삭제한 결과는 빠집니다.",
  },
  editsDeletes: {
    what: "아이디어 카드를 수정하거나 삭제한 횟수입니다. 생각이 다듬어지거나 정리된 과정을 보여 줍니다.",
    read: "행동 로그가 기록되기 시작한 뒤의 활동만 집계됩니다.",
  },
  timeline: {
    what: "회의 시작부터 일정 시간 단위로, 사람이 쓴 아이디어(파랑)와 AI에서 가져온 카드(주황)가 몇 개씩 나왔는지 보여 줍니다. ▼는 AI 분석 시점입니다.",
    read: "아이디어가 끊긴 정체 구간 뒤에 AI 분석이 있고 다시 늘어났다면, AI가 발상을 다시 이끌었을 가능성을 살펴볼 수 있습니다(인과는 아님).",
  },
  agentRequests: {
    what: "해당 에이전트로 AI 분석을 요청한 횟수입니다.",
    read: "횟수가 1~2번이면 전후 비교 값은 우연일 가능성이 큽니다.",
  },
  agentBefore: {
    what: "분석을 요청하기 직전 N분 동안 사람이 쓴 아이디어 수의 평균입니다. (N = 위에서 고른 비교 구간)",
  },
  agentAfter: {
    what: "분석 결과를 받은 뒤 N분 동안 사람이 쓴 아이디어 수의 평균입니다.",
  },
  agentChange: {
    what: "분석 후 − 분석 전. 분석 뒤에 아이디어가 평균 몇 개 더(▲) 또는 덜(▼) 나왔는지입니다.",
    read: "회의 후반엔 원래 아이디어가 줄어들기 쉬워서 AI 효과가 없어도 값이 변할 수 있습니다. 비교 구간을 바꿔도 비슷한지 확인하세요. 인과를 보려면 AI 사용/미사용 조건을 나눈 실험이 필요합니다.",
  },
  agentAdopted: {
    what: "이 에이전트의 결과에서 참가자가 보드로 가져간 카드 수입니다. AI 제안이 실제로 채택된 정도를 보여 줍니다.",
  },
  category: {
    what: "사람이 쓴 아이디어가 어떤 카테고리(브레인스토밍 → 후보 → 최종 검토 등)에 있는지의 분포입니다.",
    read: "후보·최종 검토 비중이 클수록 아이디어를 모으고 좁혀 가는 수렴 단계까지 진행했다는 뜻입니다. 현재 상태 기준입니다.",
  },
  pIdeas: { what: "이 참가자가 직접 쓴 아이디어 수입니다 (AI 카드 제외)." },
  pAiCards: { what: "이 참가자가 AI 분석 결과에서 보드로 가져간 카드 수입니다." },
  pLen: { what: "이 참가자 아이디어의 평균 글자 수입니다 (정교성)." },
  pComments: { what: "이 참가자가 단 댓글 수입니다. 괄호 안은 그중 남의 카드에 단 댓글 수입니다." },
  pAiChats: { what: "AI 패널에서 AI에게 직접 질문한 횟수입니다.", read: "행동 로그 기록 이후만 집계됩니다." },
  pRequests: { what: "이 참가자가 AI 분석을 요청한 횟수입니다." },
  pEdits: { what: "이 참가자가 카드를 수정/삭제한 횟수입니다.", read: "행동 로그 기록 이후만 집계됩니다." },
  pActive: { what: "이 참가자가 방에 접속해 있던 총 시간(분)입니다.", how: "입장~퇴장 기록을 더한 값.", read: "행동 로그 기록 이후만 집계됩니다. 창을 열어 두기만 해도 포함됩니다." },
};
