import React, { useState } from "react";
import {
  AgentAnalysisResult,
  PerspectiveAnalysis,
  EffectAnalysis,
  EmphasisAnalysis,
  GuideAnalysis,
  SearchSource,
} from "../types";

const SearchSourcesSection: React.FC<{ sources: SearchSource[] }> = ({ sources }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-green-100 rounded-xl overflow-hidden mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-green-50 hover:bg-green-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-green-700">
          <span>🔍</span>
          네이버 검색 참고 자료 ({sources.length}개)
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="divide-y divide-green-50">
          {sources.map((s, i) => (
            <a
              key={i}
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 px-4 py-3 bg-white hover:bg-green-50 transition-colors group"
            >
              <span className="text-xs font-bold text-green-600 flex-shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 group-hover:text-green-700 truncate leading-snug">
                  {s.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{s.description}</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                className="flex-shrink-0 mt-0.5 group-hover:stroke-green-500">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

interface Props {
  result: AgentAnalysisResult;
}

// 사고전환 질문형 / 제안형 UI
const PerspectiveView: React.FC<{ result: PerspectiveAnalysis }> = ({ result }) => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-bold text-gray-800 mb-3">분석완료</p>

      {/* 요약 */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
      </div>

      {/* 현재 집중 관점 */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-blue-600 mb-2">현재 집중 관점</p>
        <div className="flex flex-wrap gap-1.5">
          {result.currentFocus.map((keyword, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 bg-white"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <hr className="border-gray-100 mb-3" />

      {/* 빠진 관점 안내 */}
      <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-center justify-between mb-3">
        <p className="text-xs text-gray-600">이런 부분에 대한 논의가 빠졌어요.</p>
        <button className="text-gray-400 hover:text-gray-600 transition-colors ml-2 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* 관점 카드들 */}
      <div className="space-y-2">
        {result.perspectives.map((p, i) => (
          <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "#4F48ED", color: "white" }}
              >
                관점 {i + 1}
              </span>
              <span className="text-xs font-bold text-gray-800">{p.title}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// 효과 예측형 UI
const EffectView: React.FC<{ result: EffectAnalysis }> = ({ result }) => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-bold text-gray-800 mb-3">분석완료</p>

      {/* 요약 */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
      </div>

      {/* 현재 집중 관점 */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-blue-600 mb-2">현재 집중 관점</p>
        <div className="flex flex-wrap gap-1.5">
          {result.currentFocus.map((keyword, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 bg-white"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <hr className="border-gray-100 mb-3" />

      {/* 안내 배너 */}
      <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
        <p className="text-xs text-gray-600">📊 아이디어 실행 시 예상되는 효과예요</p>
      </div>

      {/* 예상 효과 카드들 */}
      <div className="space-y-2">
        {result.questions.map((q, i) => (
          <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
            <div className="flex items-start gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#4F48ED", color: "white" }}
              >
                효과 {i + 1}
              </span>
              <p className="text-xs text-gray-800 leading-relaxed font-medium">{q.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// 결과 강조형 UI
const EmphasisView: React.FC<{ result: EmphasisAnalysis }> = ({ result }) => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-800">분석 완료</p>
        <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
      </div>

      {/* 각 아이디어 */}
      {result.ideas.map((idea, i) => (
        <div key={i} className="mb-5">
          <p className="text-xs font-bold text-gray-700 mb-2">
            {String.fromCharCode(65 + i)} {idea.name}
          </p>

          {/* 예상 효과들 */}
          <div className="space-y-2 mb-2">
            {idea.effects.map((effect, j) => {
              const isIncrease = effect.title.includes("↑");
              const isDecrease = effect.title.includes("↓");
              const titleColor = isDecrease ? "#2563eb" : isIncrease ? "#16a34a" : "#374151";
              return (
                <div key={j} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600 font-medium">
                      {effect.label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: titleColor }}>
                      {effect.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-1">{effect.description}</p>
                  {effect.note && (
                    <p className="text-xs text-gray-400 leading-relaxed">{effect.note}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 유사 사례 */}
          {idea.similarCase && (
            <div className="rounded-lg p-3" style={{ backgroundColor: "#f9fafb" }}>
              <p className="text-xs font-semibold text-gray-500 mb-1">유사 사례</p>
              <p className="text-xs text-gray-600 leading-relaxed">{idea.similarCase}</p>
            </div>
          )}
        </div>
      ))}

      {/* 공통점 */}
      {result.commonalities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-700 mb-2">
            {result.ideas.map((_, i) => String.fromCharCode(65 + i)).join(", ")} 공통점
          </p>
          <div className="space-y-1.5">
            {result.commonalities.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="font-bold text-gray-400 flex-shrink-0">{i + 1}</span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 차이점 */}
      {result.differences.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">
            {result.ideas.map((_, i) => String.fromCharCode(65 + i)).join(", ")} 차이점
          </p>
          <div className="space-y-1.5">
            {result.differences.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="font-bold text-gray-400 flex-shrink-0">{i + 1}</span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// 결과 안내형 UI
const GuideView: React.FC<{ result: GuideAnalysis }> = ({ result }) => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-800">검토 완료</p>
        <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
      </div>

      {/* 추천 아이디어 박스 */}
      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: "#F0EFFD" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-gray-800">{result.recommendedIdea}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "#4F48ED", color: "white" }}
          >
            ✓ 추천
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{result.recommendReason}</p>
      </div>

      {/* 각 아이디어 점수 */}
      <div className="space-y-5 mb-5">
        {result.ideas.map((idea, i) => (
          <div key={i}>
            <p className="text-xs font-bold text-gray-700 mb-2">
              {String.fromCharCode(65 + i)} {idea.name}
            </p>
            <div className="space-y-2">
              {/* 실현 가능성 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">실현 가능성</span>
                  <span className="text-xs font-semibold text-gray-700">{idea.feasibility}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${idea.feasibility}%`, backgroundColor: "#3b82f6" }}
                  />
                </div>
              </div>
              {/* 사용자 편의 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">사용자 편의</span>
                  <span className="text-xs font-semibold text-gray-700">{idea.userExperience}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${idea.userExperience}%`, backgroundColor: "#eab308" }}
                  />
                </div>
              </div>
              {/* 주제 차별성 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">주제 차별성</span>
                  <span className="text-xs font-semibold text-gray-700">{idea.uniqueness}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${idea.uniqueness}%`,
                      backgroundColor: idea.uniqueness >= 50 ? "#16a34a" : "#ef4444",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 분석 한계 안내 */}
      {result.limitNote && (
        <div className="rounded-xl p-3" style={{ backgroundColor: "#fff1f2" }}>
          <p className="text-xs font-bold text-rose-600 mb-1">분석 한계 안내</p>
          <p className="text-xs text-rose-700 leading-relaxed">{result.limitNote}</p>
        </div>
      )}
    </div>
  </div>
);

const AgentAnalysisResultComponent: React.FC<Props> = ({ result }) => {
  switch (result.agentType) {
    case "question":
    case "suggestion": {
      const r = result as PerspectiveAnalysis;
      return <><PerspectiveView result={r} />{r.searchSources && r.searchSources.length > 0 && <SearchSourcesSection sources={r.searchSources} />}</>;
    }
    case "effect": {
      const r = result as EffectAnalysis;
      return <><EffectView result={r} />{r.searchSources && r.searchSources.length > 0 && <SearchSourcesSection sources={r.searchSources} />}</>;
    }
    case "emphasis":
      return <EmphasisView result={result as EmphasisAnalysis} />;
    case "guide":
      return <GuideView result={result as GuideAnalysis} />;
    default:
      return null;
  }
};

export default AgentAnalysisResultComponent;
