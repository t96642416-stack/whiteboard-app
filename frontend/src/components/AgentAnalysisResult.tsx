import React, { useState } from "react";
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
  AnalysisSnapshot,
} from "../types";

interface Props {
  result: AgentAnalysisResult;
  onAddIdea?: (title: string, content: string, snapshot?: AnalysisSnapshot) => void;
  onApplyImage?: (ideaName: string, imageUrl: string) => void;
  onUpdateResult?: (updated: AgentAnalysisResult) => void;
}

// 깊은 불변 업데이트 헬퍼
function setIn(obj: any, path: (string | number)[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  if (Array.isArray(obj)) {
    const arr = [...obj];
    arr[Number(head)] = setIn(arr[Number(head)], tail, value);
    return arr;
  }
  return { ...obj, [String(head)]: setIn(obj[String(head)], tail, value) };
}

// 인라인 편집 텍스트 컴포넌트
const ET: React.FC<{
  value: string;
  className?: string;
  multiline?: boolean;
  onSave?: (v: string) => void;
  placeholder?: string;
}> = ({ value, className = "", multiline, onSave, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  React.useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (!onSave) {
    return multiline
      ? <p className={className}>{value || placeholder}</p>
      : <span className={className}>{value || placeholder}</span>;
  }

  if (editing) {
    const base = `${className} bg-white border border-blue-300 rounded px-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300`;
    const commit = () => { onSave(draft.trim() || value); setEditing(false); };
    return multiline
      ? <textarea className={`${base} resize-y w-full block text-xs`} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit} autoFocus rows={3} />
      : <input className={`${base} inline-block w-full text-xs`} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          autoFocus />;
  }

  return (
    <span
      className={`${className} cursor-text hover:bg-amber-50 hover:ring-1 hover:ring-amber-300 rounded px-0.5 transition-colors relative group/et`}
      onClick={() => setEditing(true)}
      title="클릭하여 편집"
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
      <span className="absolute -top-0.5 -right-0.5 opacity-0 group-hover/et:opacity-100 text-amber-400 text-xs pointer-events-none">✏</span>
    </span>
  );
};

// AI 이미지 (순차 로드 + 자동 재시도)
const IdeaImage: React.FC<{ url: string; alt: string; blue?: boolean; delay?: number; onApply?: () => void }> = ({ url, alt, blue, delay = 0, onApply }) => {
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const retryRef = React.useRef(0);

  // delay 이후에 로드 시작 (동시 요청 방지)
  React.useEffect(() => {
    const t = setTimeout(() => setSrc(url), delay);
    return () => clearTimeout(t);
  }, [url, delay]);

  const handleError = () => {
    if (retryRef.current < 3) {
      retryRef.current += 1;
      // 재시도: seed 값을 바꿔서 새 요청
      const newUrl = url.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 99999)}`);
      setTimeout(() => setSrc(newUrl), 2000 * retryRef.current);
    } else {
      setFailed(true);
    }
  };

  if (failed) return null;
  return (
    <div className="flex-shrink-0 flex flex-col gap-1" style={{ width: 180 }}>
      <div
        className={`rounded-xl overflow-hidden shadow-md relative group/img ${blue ? "border-2 border-blue-200" : "border border-gray-200"}`}
        style={{ minHeight: 160, height: 160 }}
      >
        {!loaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse flex items-center justify-center rounded-xl flex-col gap-2">
            <span className="text-2xl">🎨</span>
            <span className="text-xs text-gray-400 font-medium">이미지 생성 중...</span>
          </div>
        )}
        {src && (
          <img
            src={src}
            alt={`${alt} 적용 예시`}
            className="w-full h-full object-cover"
            style={{ height: 160, display: loaded ? "block" : "none" }}
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
        )}
        {/* 이미지 위 오버레이 버튼 */}
        {loaded && onApply && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/img:bg-opacity-30 transition-all flex items-end justify-center pb-2 opacity-0 group-hover/img:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onApply(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-800 shadow-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              보드 카드에 적용
            </button>
          </div>
        )}
      </div>
      {loaded ? (
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs leading-tight ${blue ? "text-blue-400" : "text-gray-400"}`}>🤖 AI 예상 이미지</p>
          {onApply && (
            <button
              onClick={onApply}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5 flex-shrink-0"
              title="보드 카드에 이미지 적용"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              적용
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

// 드래그 가능한 카드 래퍼
const DraggableCard: React.FC<{
  title: string;
  content: string;
  snapshot?: AnalysisSnapshot;
  onAdd?: (title: string, content: string, snapshot?: AnalysisSnapshot) => void;
  children: React.ReactNode;
}> = ({ title, content, snapshot, onAdd, children }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/agent-idea", JSON.stringify({ title, content, snapshot }));
    e.dataTransfer.effectAllowed = "copy";
  };
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="relative group cursor-grab active:cursor-grabbing"
    >
      {/* 드래그 핸들 (왼쪽) */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="#6b7280">
          <circle cx="2" cy="2" r="1.5"/><circle cx="6" cy="2" r="1.5"/>
          <circle cx="2" cy="7" r="1.5"/><circle cx="6" cy="7" r="1.5"/>
          <circle cx="2" cy="12" r="1.5"/><circle cx="6" cy="12" r="1.5"/>
        </svg>
      </div>
      {/* 빠른 추가 버튼 (우측 상단) */}
      {onAdd && (
        <button
          draggable={false}
          onClick={(e) => { e.stopPropagation(); onAdd(title, content, snapshot); }}
          className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm hover:bg-indigo-600 z-10"
          title="보드에 바로 추가"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}
      {children}
    </div>
  );
};

// [검색결과 N] 파싱 → 정확한 출처 연결, 없으면 null 반환
const parseSourceRef = (
  text: string,
  sources: SearchSource[]
): { cleanText: string; source: SearchSource | null } => {
  if (!sources || sources.length === 0) return { cleanText: text, source: null };
  const match = text.match(/\[검색결과\s*(\d+)\]/);
  if (match) {
    const idx = parseInt(match[1], 10) - 1;
    const source = sources[Math.max(0, Math.min(idx, sources.length - 1))];
    const cleanText = text.replace(/\s*\[검색결과\s*\d+\]/g, "").trim();
    return { cleanText, source };
  }
  // [검색결과 N] 없으면 링크 연결 안 함
  return { cleanText: text, source: null };
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
const PerspectiveView: React.FC<{ result: PerspectiveAnalysis; sources?: SearchSource[]; onAddIdea?: (t: string, c: string, snapshot?: AnalysisSnapshot) => void; onUpdateResult?: (u: PerspectiveAnalysis) => void }> = ({ result, sources, onAddIdea, onUpdateResult }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "관점 제시형";
  const upd = (path: (string | number)[], v: string) => onUpdateResult?.(setIn(result, path, v));
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석 완료</p>
          {onUpdateResult && <span className="text-xs text-amber-500 flex items-center gap-1">✏ 클릭해서 편집</span>}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <ET value={result.summary} className="text-xs text-gray-600 leading-relaxed" multiline
            onSave={onUpdateResult ? v => upd(["summary"], v) : undefined} />
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
              <DraggableCard key={i} title={p.title} content={p.description} snapshot={{ agentType: 'suggestion', itemData: { ...p, index: i } }} onAdd={onAddIdea}>
                <div className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: "#4F48ED", color: "white" }}>
                      관점 {i + 1}
                    </span>
                    <ET value={p.title} className="text-xs font-bold text-gray-800 flex-1"
                      onSave={onUpdateResult ? v => upd(["perspectives", i, "title"], v) : undefined} />
                    {src && <SrcLink source={src} label={`${i % sources!.length + 1}`} />}
                  </div>
                  <ET value={p.description} className="text-xs text-gray-600 leading-relaxed" multiline
                    onSave={onUpdateResult ? v => upd(["perspectives", i, "description"], v) : undefined} />
                </div>
              </DraggableCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 관점 탐색형 UI
const ExploreView: React.FC<{ result: QuestionAnalysis; sources?: SearchSource[]; onAddIdea?: (t: string, c: string, snapshot?: AnalysisSnapshot) => void; onUpdateResult?: (u: QuestionAnalysis) => void }> = ({ result, sources, onAddIdea, onUpdateResult }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "관점 탐색형";
  const upd = (path: (string | number)[], v: string) => onUpdateResult?.(setIn(result, path, v));
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석완료</p>
          {onUpdateResult && <span className="text-xs text-amber-500 flex items-center gap-1">✏ 클릭해서 편집</span>}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <ET value={result.summary} className="text-xs text-gray-600 leading-relaxed" multiline
            onSave={onUpdateResult ? v => upd(["summary"], v) : undefined} />
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
              <DraggableCard key={i} title={`Q${i + 1}. ${q.text.slice(0, 40)}`} content={q.text} snapshot={{ agentType: 'question', itemData: { ...q, index: i } }} onAdd={onAddIdea}>
                <div className="rounded-xl p-3" style={{ backgroundColor: "#F0EFFD" }}>
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "#4F48ED", color: "white" }}>
                      Q{i + 1}
                    </span>
                    <ET value={q.text} className="text-xs text-gray-800 leading-relaxed font-medium flex-1" multiline
                      onSave={onUpdateResult ? v => upd(["questions", i, "text"], v) : undefined} />
                    {src && <SrcLink source={src} label={`${i % sources!.length + 1}`} />}
                  </div>
                </div>
              </DraggableCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 효과 예측형 UI - note를 링크로
const EmphasisView: React.FC<{ result: EmphasisAnalysis; sources?: SearchSource[]; onAddIdea?: (t: string, c: string, snapshot?: AnalysisSnapshot) => void; onApplyImage?: (ideaName: string, imageUrl: string) => void; onUpdateResult?: (u: EmphasisAnalysis) => void }> = ({ result, sources, onAddIdea, onApplyImage, onUpdateResult }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "효과 예측형";
  const upd = (path: (string | number)[], v: string) => onUpdateResult?.(setIn(result, path, v));
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석 완료</p>
          {onUpdateResult
            ? <span className="text-xs text-amber-500 flex items-center gap-1">✏ 클릭해서 편집</span>
            : <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>}
        </div>

        {result.ideas.map((idea, i) => (
          <div key={i} className="mb-6 pb-5 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
            {/* 아이디어 헤더 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-gray-500">{String.fromCharCode(65 + i)}</span>
              <span className="text-xs font-bold text-gray-800">{idea.name}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length].bg, color: IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length].text }}>
                아이디어 {String.fromCharCode(65 + i)}
              </span>
            </div>

            {/* 텍스트(좌) + 이미지(우) 나란히 */}
            <div className="flex gap-3">
              {/* 왼쪽: 효과 목록 + 유사 사례 */}
              <div className="flex-1 min-w-0 space-y-2">
                {idea.effects.map((effect, j) => {
                  const { cleanText: noteText, source: src } = effect.note
                    ? parseSourceRef(effect.note, sources || [])
                    : { cleanText: "", source: null };
                  return (
                    <DraggableCard key={j} title={effect.title} content={`${effect.description}${noteText ? `\n\n${noteText}` : ""}`} snapshot={{ agentType: 'emphasis', itemData: { ideaName: idea.name, ideaIndex: i, effect } }} onAdd={onAddIdea}>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600 font-medium flex-shrink-0">
                            {effect.label}
                          </span>
                          <ET value={effect.title} className="text-xs font-bold text-indigo-700"
                            onSave={onUpdateResult ? v => upd(["ideas", i, "effects", j, "title"], v) : undefined} />
                        </div>
                        <ET value={effect.description} className="text-xs text-gray-600 leading-relaxed mb-1" multiline
                          onSave={onUpdateResult ? v => upd(["ideas", i, "effects", j, "description"], v) : undefined} />
                        {effect.note && noteText && (
                          src ? (
                            <a href={src.link} target="_blank" rel="noopener noreferrer" draggable={false}
                              className="text-xs text-green-700 hover:text-green-800 hover:underline flex items-center gap-1 leading-relaxed">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              {noteText}
                            </a>
                          ) : (
                            <p className="text-xs text-gray-400 leading-relaxed flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <ET value={noteText} className="text-xs text-gray-400 leading-relaxed"
                                onSave={onUpdateResult ? v => upd(["ideas", i, "effects", j, "note"], v) : undefined} />
                            </p>
                          )
                        )}
                      </div>
                    </DraggableCard>
                  );
                })}

                {idea.similarCase && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: "#f9fafb" }}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">유사 사례</p>
                    <ET value={idea.similarCase} className="text-xs text-gray-600 leading-relaxed" multiline
                      onSave={onUpdateResult ? v => upd(["ideas", i, "similarCase"], v) : undefined} />
                  </div>
                )}
              </div>

              {/* 오른쪽: AI 생성 이미지 */}
              {idea.imageUrl && (
                <IdeaImage url={idea.imageUrl} alt={idea.name} delay={i * 1000}
                  onApply={onApplyImage ? () => onApplyImage(idea.name, idea.imageUrl!) : undefined} />
              )}
            </div>
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
const AttributeView: React.FC<{ result: AttributeAnalysis; sources?: SearchSource[]; onAddIdea?: (t: string, c: string, snapshot?: AnalysisSnapshot) => void; onApplyImage?: (ideaName: string, imageUrl: string) => void; onUpdateResult?: (u: AttributeAnalysis) => void }> = ({ result, sources, onAddIdea, onApplyImage, onUpdateResult }) => {
  const agentName = AGENT_OPTIONS.find(opt => opt.type === result.agentType)?.name || "속성 분석형";
  const upd = (path: (string | number)[], v: string) => onUpdateResult?.(setIn(result, path, v));
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">{agentName}, 분석 완료</p>
          {onUpdateResult
            ? <span className="text-xs text-amber-500 flex items-center gap-1">✏ 클릭해서 편집</span>
            : <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>}
        </div>

        {result.ideas.map((idea, idx) => {
          const badge = IDEA_BADGE_COLORS[idx % Object.keys(IDEA_BADGE_COLORS).length];
          const label = String.fromCharCode(65 + idx);
          const ideaSummary = [
            idea.pros.length > 0 ? `장점: ${idea.pros.map(p => p.point).join(", ")}` : "",
            idea.cons.length > 0 ? `단점: ${idea.cons.map(c => c.point).join(", ")}` : "",
          ].filter(Boolean).join("\n");
          return (
            <DraggableCard key={idea.id} title={idea.name} content={ideaSummary} snapshot={{ agentType: 'attribute', itemData: { ...idea, index: idx } }} onAdd={onAddIdea}>
            <div className="mb-5 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-500">{label}</span>
                <span className="text-xs font-bold text-gray-800 flex-1">{idea.name}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: badge.bg, color: badge.text }}>
                  아이디어 {label}
                </span>
              </div>
              {/* 텍스트(좌) + 이미지(우) */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 gap-2">
                {/* 장점 */}
                <div className="rounded-lg p-3" style={{ backgroundColor: "#f0fdf4" }}>
                  <p className="text-xs font-bold text-green-700 mb-2">장점</p>
                  <div className="space-y-2">
                    {idea.pros.map((pro, j) => {
                      const { cleanText: evText, source: src } = pro.evidence
                        ? parseSourceRef(pro.evidence, sources || [])
                        : { cleanText: "", source: null };
                      return (
                        <div key={j}>
                          <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                            <span className="flex-shrink-0">{j + 1}</span>
                            <ET value={pro.point} className="flex-1"
                              onSave={onUpdateResult ? v => upd(["ideas", idx, "pros", j, "point"], v) : undefined} />
                          </p>
                          {pro.evidence && (
                            src ? (
                              <a href={src.link} target="_blank" rel="noopener noreferrer" draggable={false}
                                className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{evText}
                              </a>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>
                                <ET value={evText || pro.evidence} className="leading-relaxed"
                                  onSave={onUpdateResult ? v => upd(["ideas", idx, "pros", j, "evidence"], v) : undefined} />
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
                      const { cleanText: evText, source: src } = con.evidence
                        ? parseSourceRef(con.evidence, sources || [])
                        : { cleanText: "", source: null };
                      return (
                        <div key={j}>
                          <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                            <span className="flex-shrink-0">{j + 1}</span>
                            <ET value={con.point} className="flex-1"
                              onSave={onUpdateResult ? v => upd(["ideas", idx, "cons", j, "point"], v) : undefined} />
                          </p>
                          {con.evidence && (
                            src ? (
                              <a href={src.link} target="_blank" rel="noopener noreferrer" draggable={false}
                                className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>{evText}
                              </a>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 leading-relaxed">
                                <span className="flex-shrink-0">📄</span>
                                <ET value={evText || con.evidence} className="leading-relaxed"
                                  onSave={onUpdateResult ? v => upd(["ideas", idx, "cons", j, "evidence"], v) : undefined} />
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
                {/* 오른쪽: AI 생성 이미지 */}
                {idea.imageUrl && (
                  <IdeaImage url={idea.imageUrl} alt={idea.name} blue delay={idx * 1000}
                    onApply={onApplyImage ? () => onApplyImage(idea.name, idea.imageUrl!) : undefined} />
                )}
              </div>
            </div>
            </DraggableCard>
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
const GuideView: React.FC<{ result: GuideAnalysis; sources?: SearchSource[]; onAddIdea?: (t: string, c: string, snapshot?: AnalysisSnapshot) => void }> = ({ result, sources, onAddIdea }) => {
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
              <DraggableCard key={i} title={idea.name} content={idea.name} snapshot={{ agentType: 'guide', itemData: { ...idea, index: i, score: (idea as any).score } }} onAdd={onAddIdea}>
              <div>
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
              </DraggableCard>
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

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
        {result.ideas.map((idea, i) => {
          const badge = IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length];
          return (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
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

const AgentAnalysisResultComponent: React.FC<Props> = ({ result, onAddIdea, onApplyImage, onUpdateResult }) => {
  switch (result.agentType) {
    case "suggestion":
      return <PerspectiveView result={result as PerspectiveAnalysis} sources={(result as PerspectiveAnalysis).searchSources} onAddIdea={onAddIdea}
        onUpdateResult={onUpdateResult ? (u) => onUpdateResult(u) : undefined} />;
    case "question":
      return <ExploreView result={result as QuestionAnalysis} sources={(result as QuestionAnalysis).searchSources} onAddIdea={onAddIdea}
        onUpdateResult={onUpdateResult ? (u) => onUpdateResult(u) : undefined} />;
    case "effect":
      return <EffectView result={result as EffectAnalysis} />;
    case "attribute":
      return <AttributeView result={result as AttributeAnalysis} sources={(result as AttributeAnalysis).searchSources} onAddIdea={onAddIdea}
        onApplyImage={onApplyImage} onUpdateResult={onUpdateResult ? (u) => onUpdateResult(u) : undefined} />;
    case "emphasis":
      return <EmphasisView result={result as EmphasisAnalysis} sources={(result as EmphasisAnalysis).searchSources} onAddIdea={onAddIdea}
        onApplyImage={onApplyImage} onUpdateResult={onUpdateResult ? (u) => onUpdateResult(u) : undefined} />;
    case "guide":
      return <GuideView result={result as GuideAnalysis} sources={(result as GuideAnalysis).searchSources} onAddIdea={onAddIdea} />;
    case "advise":
      return <AdviseView result={result as AdviseAnalysis} sources={(result as AdviseAnalysis).searchSources} />;
    default:
      return null;
  }
};

export default AgentAnalysisResultComponent;
