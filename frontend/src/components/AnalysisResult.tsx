import React, { useState } from "react";
import { AnalysisResult as AnalysisResultType, IDEA_BADGE_COLORS, SearchSource } from "../types";

const SearchSourcesSection: React.FC<{ sources: SearchSource[] }> = ({ sources }) => (
  <div className="border border-green-100 rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50">
      <span className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
        네이버 검색 참고 자료
      </span>
    </div>
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
  </div>
);

interface AnalysisResultProps {
  result: AnalysisResultType;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result }) => {
  const [expandedIdeas, setExpandedIdeas] = useState<Set<string>>(new Set());

  const toggleIdea = (id: string) => {
    setExpandedIdeas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const ideaLabels = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="space-y-4">
      {/* 아이디어별 분석 */}
      {result.ideas.map((idea, idx) => {
        const badgeColor = IDEA_BADGE_COLORS[idx % Object.keys(IDEA_BADGE_COLORS).length];
        const isExpanded = expandedIdeas.has(idea.id);
        const label = ideaLabels[idx] || String(idx + 1);

        return (
          <div
            key={idea.id}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
          >
            {/* 아이디어 헤더 */}
            <button
              onClick={() => toggleIdea(idea.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: badgeColor.bg,
                  color: badgeColor.text,
                }}
              >
                {label}
              </span>
              <span className="font-semibold text-gray-800 text-sm flex-1">
                {idea.name}
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-green-600 font-medium">+{idea.pros.length}</span>
                <span>/</span>
                <span className="text-red-500 font-medium">-{idea.cons.length}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* 장점 */}
                {idea.pros.length > 0 && (
                  <div className="p-3" style={{ backgroundColor: "#f0fdf4" }}>
                    <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      장점
                    </p>
                    <ul className="space-y-2">
                      {idea.pros.map((pro, i) => (
                        <li key={i} className="text-xs">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-200 text-green-800 flex items-center justify-center font-bold text-xs leading-none mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-green-900 font-medium">{pro.point}</p>
                              {pro.evidence && (
                                <p className="text-green-600 mt-0.5 leading-relaxed">{pro.evidence}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 단점 */}
                {idea.cons.length > 0 && (
                  <div className="p-3" style={{ backgroundColor: "#fef2f2" }}>
                    <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      단점
                    </p>
                    <ul className="space-y-2">
                      {idea.cons.map((con, i) => (
                        <li key={i} className="text-xs">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold text-xs leading-none mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-red-900 font-medium">{con.point}</p>
                              {con.evidence && (
                                <p className="text-red-500 mt-0.5 leading-relaxed">{con.evidence}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 공통점 */}
      {result.commonalities.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-2.5 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
              </svg>
            </span>
            공통점
          </p>
          <ul className="space-y-1.5">
            {result.commonalities.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="flex-shrink-0 text-gray-400 font-mono font-bold mt-0.5">{i + 1}.</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 차이점 */}
      {result.differences.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 mb-2.5 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-200 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
            차이점
          </p>
          <ul className="space-y-1.5">
            {result.differences.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-800">
                <span className="flex-shrink-0 text-blue-400 font-mono font-bold mt-0.5">{i + 1}.</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 에이전트 추가 응답 */}
      {result.agentResponse && (
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            AI 에이전트 추가 분석
          </p>
          <p className="text-xs text-purple-800 leading-relaxed whitespace-pre-wrap">
            {result.agentResponse}
          </p>
        </div>
      )}

      {/* 네이버 검색 출처 */}
      {result.searchSources && result.searchSources.length > 0 && (
        <SearchSourcesSection sources={result.searchSources} />
      )}
    </div>
  );
};

export default AnalysisResult;
