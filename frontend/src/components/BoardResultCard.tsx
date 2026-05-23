import React from "react";
import { Idea, IDEA_BADGE_COLORS, AGENT_OPTIONS } from "../types";

interface Props {
  idea: Idea;
  onDelete: (id: string) => void;
}

// 점수 바 컴포넌트
const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="mb-1.5">
    <div className="flex justify-between mb-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-700">{value}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className="h-1.5 rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  </div>
);

const BoardResultCard: React.FC<Props> = ({ idea, onDelete }) => {
  const snap = idea.analysisSnapshot!;
  const agentOption = AGENT_OPTIONS.find(o => o.type === snap.agentType);
  const agentLabel = agentOption ? agentOption.name : "AI 분석";
  const d = snap.itemData;

  const renderContent = () => {
    switch (snap.agentType) {
      case "suggestion": // 관점 제시형
        return (
          <div className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "#4F48ED", color: "white" }}>
                관점 {(d.index ?? 0) + 1}
              </span>
              <span className="text-xs font-bold text-gray-800 flex-1 leading-snug">{d.title}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{d.description}</p>
          </div>
        );

      case "question": // 관점 탐색형
        return (
          <div className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
            <div className="flex items-start gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#4F48ED", color: "white" }}>
                Q{(d.index ?? 0) + 1}
              </span>
              <p className="text-xs text-gray-800 leading-relaxed font-medium">{d.text}</p>
            </div>
          </div>
        );

      case "emphasis": // 효과 예측형
        return (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-gray-500 font-medium">{d.ideaName}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600 font-medium">
                {d.effect?.label}
              </span>
              <span className="text-xs font-bold" style={{ color: "#4F48ED" }}>
                {d.effect?.title}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{d.effect?.description}</p>
          </div>
        );

      case "attribute": // 속성 분석형
        return (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: IDEA_BADGE_COLORS[(d.index ?? 0) % Object.keys(IDEA_BADGE_COLORS).length].bg,
                  color: IDEA_BADGE_COLORS[(d.index ?? 0) % Object.keys(IDEA_BADGE_COLORS).length].text
                }}>
                {String.fromCharCode(65 + (d.index ?? 0))}
              </span>
              <span className="text-xs font-bold text-gray-800">{d.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-green-600 mb-1">장점</p>
                {(d.pros ?? []).slice(0, 2).map((p: any, i: number) => (
                  <p key={i} className="text-xs text-gray-600 leading-relaxed mb-0.5">· {p.point}</p>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-red-500 mb-1">단점</p>
                {(d.cons ?? []).slice(0, 2).map((c: any, i: number) => (
                  <p key={i} className="text-xs text-gray-600 leading-relaxed mb-0.5">· {c.point}</p>
                ))}
              </div>
            </div>
          </div>
        );

      case "guide": // 결과 강조형
      case "advise": // 결과 안내형
        return (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: IDEA_BADGE_COLORS[(d.index ?? 0) % Object.keys(IDEA_BADGE_COLORS).length].bg,
                  color: IDEA_BADGE_COLORS[(d.index ?? 0) % Object.keys(IDEA_BADGE_COLORS).length].text
                }}>
                {String.fromCharCode(65 + (d.index ?? 0))}
              </span>
              <span className="text-xs font-bold text-gray-800">{d.name}</span>
              {d.score != null && (
                <span className="ml-auto text-xs font-bold text-indigo-600">{d.score}점</span>
              )}
            </div>
            <ScoreBar label="실현 가능성" value={d.feasibility ?? 0} color="#4F48ED" />
            <ScoreBar label="사용자 편의" value={d.userExperience ?? 0} color="#eab308" />
            <ScoreBar label="차별성" value={d.uniqueness ?? 0} color={d.uniqueness >= 50 ? "#16a34a" : "#ef4444"} />
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">{idea.content}</p>
          </div>
        );
    }
  };

  return (
    <div
      className="relative rounded-xl shadow-md overflow-hidden group"
      style={{
        backgroundColor: "white",
        border: "1px solid rgba(79,72,237,0.15)",
        boxShadow: "2px 3px 10px rgba(79,72,237,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      {/* 상단 배지 바 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-indigo-50"
        style={{ backgroundColor: "#F0EFFD" }}>
        <span className="text-xs font-semibold text-indigo-700">{agentLabel}</span>
        <span className="ml-auto text-xs text-indigo-400">{idea.author}</span>
      </div>

      {/* 내용 */}
      <div className="p-3">
        {renderContent()}
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onDelete(idea.id)}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center
                   bg-white bg-opacity-0 hover:bg-opacity-80 text-indigo-300 hover:text-gray-600
                   opacity-0 group-hover:opacity-100 transition-all duration-150"
        aria-label="삭제"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="11" y2="11" />
          <line x1="11" y1="1" x2="1" y2="11" />
        </svg>
      </button>
    </div>
  );
};

export default BoardResultCard;
