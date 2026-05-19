import React from "react";
import {
  AgentAnalysisResult,
  PerspectiveAnalysis,
  QuestionAnalysis,
  EffectAnalysis,
  AttributeAnalysis,
  EmphasisAnalysis,
  GuideAnalysis,
  AdviseAnalysis,
  SearchSource,
  IDEA_BADGE_COLORS,
  AGENT_OPTIONS,
} from "../types";

interface Props {
  result: AgentAnalysisResult;
}

// 증거 텍스트와 가장 관련 있는 출처를 단어 매칭으로 찾기
const findBestSource = (text: string, sources: SearchSource[], usedIndices?: Set<number>): SearchSource | null => {
  if (!sources || sources.length === 0) return null;
  const words = text.toLowerCase().replace(/[()[\]]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  let bestScore = -1;
  let bestIdx = 0;
  sources.forEach((src, idx) => {
    const srcText = `${src.title} ${src.description}`.toLowerCase();
    let score = words.reduce((acc, w) => acc + (srcText.includes(w) ? 1 : 0), 0);
    // 이미 사용된 인덱스에 약간 페널티 (중복 최소화)
    if (usedIndices?.has(idx)) score -= 0.5;
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  });
  usedIndices?.add(bestIdx);
  return sources[bestIdx];
};

// 소스 링크 뱃지 (작은 인라인 버튼)
const SrcLink: React.FC<{ source: SearchSource; label?: string }> = ({ source, label }) => (
  <a
    href={source.link}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-0.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded px-1 py-0.5 transition-colors flex-shrink-0"
    title={source.title}
  >
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
    {label || "출처"}
  </a>
);

// 관점 제시형 UI
const PerspectiveView: React.FC<{ result: PerspectiveAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "관점 제시형";
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3">{agentName}, 분석 완료</p>
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
        </div>
        <div className="mb-3">
          <p className="text-xs font-semibold text-blue-600 mb-2">현재 집중 관점</p>
          <div className="flex flex-wrap gap-1.5">
            {result.currentFocus.map((keyword, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 bg-white">
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <hr className="border-gray-100 mb-3" />
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-center justify-between mb-3">
          <p className="text-xs text-gray-600">이런 부분에 대한 논의가 빠졌어요.</p>
          <button className="text-gray-400 hover:text-gray-600 transition-colors ml-2 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {result.perspectives.map((p, i) => {
            const src = sources && sources.length > 0 ? sources[i % sources.length] : null;
            return (
              <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: "#4F48ED", color: "white" }}>
                    관점 {i + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-800 flex-1">{p.title}</span>
                  {src && <SrcLink source={src} label={`${i % sources!.length + 1}`} />}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{p.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 관점 탐색형 UI
const ExploreView: React.FC<{ result: QuestionAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "관점 탐색형";
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3">{agentName}, 분석완료</p>
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
        </div>
        <div className="mb-3">
          <p className="text-xs font-semibold text-blue-600 mb-2">현재 집중 관점</p>
          <div className="flex flex-wrap gap-1.5">
            {result.currentFocus.map((keyword, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 bg-white">
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <hr className="border-gray-100 mb-3" />
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-center justify-between mb-3">
          <p className="text-xs text-gray-600">이런 부분도 생각해볼 수 있어요</p>
          <button className="text-gray-400 hover:text-gray-600 transition-colors ml-2 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {result.questions.map((q, i) => {
            const src = sources && sources.length > 0 ? sources[i % sources.length] : null;
            return (
              <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: "#4F48ED", color: "white" }}>
                    Q{i + 1}
                  </span>
                  <p className="text-xs text-gray-800 leading-relaxed font-medium flex-1">{q.text}</p>
                  {src && <SrcLink source={src} label={`${i % sources!.length + 1}`} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 효과 예측형 UI - note를 링크로
const EmphasisView: React.FC<{ result: EmphasisAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "효과 예측형";
  const usedIndices = new Set<number>();
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석 완료</p>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
        </div>

        {result.ideas.map((idea, i) => (
          <div key={i} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-500">{String.fromCharCode(65 + i)}</span>
              <span className="text-xs font-bold text-gray-800">{idea.name}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length].bg, color: IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length].text }}>
                아이디어 {String.fromCharCode(65 + i)}
              </span>
            </div>

            <div className="space-y-2 mb-2">
              {idea.effects.map((effect, j) => {
                const isIncrease = effect.title.includes("↑") || effect.title.includes("증가");
                const isDecrease = effect.title.includes("↓") || effect.title.includes("감소");
                const titleColor = isDecrease ? "#2563eb" : isIncrease ? "#16a34a" : "#374151";
                const src = effect.note ? findBestSource(effect.note, sources || [], usedIndices) : null;
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
                      src ? (
                        <a href={src.link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-700 hover:text-green-800 hover:underline flex items-center gap-1 leading-relaxed">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {effect.note}
                        </a>
                      ) : (
                        <p className="text-xs text-gray-400 leading-relaxed flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {effect.note}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {idea.similarCase && (
              <div className="rounded-lg p-3" style={{ backgroundColor: "#f9fafb" }}>
                <p className="text-xs font-semibold text-gray-500 mb-1">유사 사례</p>
                <p className="text-xs text-gray-600 leading-relaxed">{idea.similarCase}</p>
              </div>
            )}
          </div>
        ))}

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
};

// 속성 분석형 UI - evidence를 링크로
const AttributeView: React.FC<{ result: AttributeAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "속성 분석형";
  const usedIndices = new Set<number>();
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석 완료</p>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
        </div>

        {result.ideas.map((idea, idx) => {
          const badge = IDEA_BADGE_COLORS[idx % Object.keys(IDEA_BADGE_COLORS).length];
          const label = String.fromCharCode(65 + idx);
          return (
            <div key={idea.id} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-500">{label}</span>
                <span className="text-xs font-bold text-gray-800 flex-1">{idea.name}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: badge.bg, color: badge.text }}>
                  아이디어 {label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* 장점 */}
                <div className="rounded-lg p-3" style={{ backgroundColor: "#f0fdf4" }}>
                  <p className="text-xs font-bold text-green-700 mb-2">장점</p>
                  <div className="space-y-2">
                    {idea.pros.map((pro, j) => {
                      const src = pro.evidence ? findBestSource(pro.evidence, sources || [], usedIndices) : null;
                      return (
                        <div key={j}>
                          <p className="text-xs font-semibold text-gray-800">{j + 1} {pro.point}</p>
                          {pro.evidence && (
                            src ? (
                              <a href={src.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{pro.evidence}
                              </a>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{pro.evidence}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 단점 */}
                <div className="rounded-lg p-3" style={{ backgroundColor: "#fef2f2" }}>
                  <p className="text-xs font-bold text-red-600 mb-2">단점</p>
                  <div className="space-y-2">
                    {idea.cons.map((con, j) => {
                      const src = con.evidence ? findBestSource(con.evidence, sources || [], usedIndices) : null;
                      return (
                        <div key={j}>
                          <p className="text-xs font-semibold text-gray-800">{j + 1} {con.point}</p>
                          {con.evidence && (
                            src ? (
                              <a href={src.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{con.evidence}
                              </a>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{con.evidence}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {result.commonalities.length > 0 && (
          <div className="mb-3">
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

        {result.differences.length > 0 && (
          <div className="mb-3">
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

        {result.agentResponse && (
          <div className="rounded-xl p-3" style={{ backgroundColor: "#EEF2FF" }}>
            <p className="text-xs font-semibold text-indigo-700 leading-relaxed">{result.agentResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 결과 강조형 UI
const GuideView: React.FC<{ result: GuideAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "결과 강조형";
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">{agentName}, 검토 완료</p>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
        </div>

        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: "#F0EFFD" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-gray-800">{result.recommendedIdea}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "#4F48ED", color: "white" }}>
              ✓ 추천
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{result.recommendReason}</p>
        </div>

        <div className="space-y-5 mb-5">
          {result.ideas.map((idea, i) => {
            const src = sources && sources.length > 0 ? sources[i % sources.length] : null;
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-bold text-gray-700">
                    {String.fromCharCode(65 + i)} {idea.name}
                  </p>
                  {src && <SrcLink source={src} label={`${i % sources!.length + 1}`} />}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">실현 가능성</span>
                      <span className="text-xs font-semibold text-gray-700">{idea.feasibility}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${idea.feasibility}%`, backgroundColor: "#3b82f6" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">사용자 편의</span>
                      <span className="text-xs font-semibold text-gray-700">{idea.userExperience}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${idea.userExperience}%`, backgroundColor: "#eab308" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">주제 차별성</span>
                      <span className="text-xs font-semibold text-gray-700"
                        style={{ color: idea.uniqueness >= 50 ? "#374151" : "#ef4444" }}>
                        {idea.uniqueness}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${idea.uniqueness}%`, backgroundColor: idea.uniqueness >= 50 ? "#16a34a" : "#ef4444" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {result.limitNote && (
          <div className="rounded-xl p-3" style={{ backgroundColor: "#fff1f2" }}>
            <p className="text-xs font-bold text-rose-600 mb-1">분석 한계 안내</p>
            <p className="text-xs text-rose-700 leading-relaxed">{result.limitNote}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 결과 안내형 UI
const AdviseView: React.FC<{ result: AdviseAnalysis; sources?: SearchSource[] }> = ({ result, sources }) => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-800">결과 안내형, 검토 완료</p>
        <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4">
        <p className="text-xs font-bold text-gray-700 mb-2.5">기준별 결과</p>
        <div className="space-y-2">
          {result.criteriaResults.map((c, i) => {
            const winnerIdx = c.winner.charCodeAt(0) - 65;
            const badge = IDEA_BADGE_COLORS[winnerIdx % Object.keys(IDEA_BADGE_COLORS).length];
            const src = sources && sources.length > 0 ? sources[i % sources.length] : null;
            return (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{c.criterion}</span>
                <div className="flex items-center gap-2">
                  {src ? (
                    <a href={src.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-green-700 hover:underline">
                      → {c.winner}안 우위
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">→ {c.winner}안 우위</span>
                  )}
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: badge.bg, color: badge.text }}>
                    {c.winner}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {result.ideas.map((idea, i) => {
          const badge = IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length];
          return (
            <div key={i} className="flex-1 bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: badge.bg, color: badge.text }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-xs font-semibold text-gray-700 truncate">{idea.name}</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-500">실현 가능성</span>
                    <span className="text-xs font-medium text-gray-700">{idea.feasibility}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${idea.feasibility}%`, backgroundColor: "#3b82f6" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-500">사용자 편의</span>
                    <span className="text-xs font-medium text-gray-700">{idea.userExperience}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${idea.userExperience}%`, backgroundColor: "#eab308" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-500">차별성</span>
                    <span className="text-xs font-medium"
                      style={{ color: idea.uniqueness >= 50 ? "#16a34a" : "#ef4444" }}>
                      {idea.uniqueness}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full"
                      style={{ width: `${idea.uniqueness}%`, backgroundColor: idea.uniqueness >= 50 ? "#16a34a" : "#ef4444" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#EEF2FF" }}>
        <p className="text-xs font-semibold text-indigo-700 leading-relaxed">{result.recommendation}</p>
      </div>

      {result.limitNote && (
        <div className="rounded-xl p-3" style={{ backgroundColor: "#fff1f2" }}>
          <p className="text-xs font-bold text-rose-600 mb-1">분석 한계 안내</p>
          <p className="text-xs text-rose-700 leading-relaxed">{result.limitNote}</p>
        </div>
      )}
    </div>
  </div>
);

// 레거시 EffectView
const EffectView: React.FC<{ result: EffectAnalysis }> = ({ result }) => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-bold text-gray-800 mb-3">분석완료</p>
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
      </div>
      <div className="space-y-2">
        {result.questions.map((q, i) => (
          <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
            <div className="flex items-start gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#4F48ED", color: "white" }}>
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

const AgentAnalysisResultComponent: React.FC<Props> = ({ result }) => {
  switch (result.agentType) {
    case "suggestion":
      return <PerspectiveView result={result as PerspectiveAnalysis} sources={(result as PerspectiveAnalysis).searchSources} />;
    case "question":
      return <ExploreView result={result as QuestionAnalysis} sources={(result as QuestionAnalysis).searchSources} />;
    case "effect":
      return <EffectView result={result as EffectAnalysis} />;
    case "attribute":
      return <AttributeView result={result as AttributeAnalysis} sources={(result as AttributeAnalysis).searchSources} />;
    case "emphasis":
      return <EmphasisView result={result as EmphasisAnalysis} sources={(result as EmphasisAnalysis).searchSources} />;
    case "guide":
      return <GuideView result={result as GuideAnalysis} sources={(result as GuideAnalysis).searchSources} />;
    case "advise":
      return <AdviseView result={result as AdviseAnalysis} sources={(result as AdviseAnalysis).searchSources} />;
    default:
      return null;
  }
};

export default AgentAnalysisResultComponent;
