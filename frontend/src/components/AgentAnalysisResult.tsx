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

// 이미지 업로드 위젯 (전체 너비, 세로 배치)
const IdeaImage: React.FC<{
  alt: string;
  blue?: boolean;
  onApplyImage?: (url: string) => void;
}> = ({ alt, blue, onApplyImage }) => {
  const [src, setSrc] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full flex flex-col gap-1 mt-2">
      <div
        className={`w-full rounded-xl overflow-hidden relative group/img cursor-pointer ${blue ? "border-2 border-blue-200" : "border border-gray-200"} ${src ? "shadow-md" : "border-dashed hover:bg-gray-50"}`}
        style={{ minHeight: src ? undefined : 120, aspectRatio: src ? "16/9" : undefined }}
        onClick={() => !src && fileInputRef.current?.click()}
      >
        {src ? (
          <>
            <img src={src} alt={`${alt} 이미지`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/img:bg-opacity-30 transition-all flex items-end justify-center pb-2 gap-1.5 opacity-0 group-hover/img:opacity-100">
              {onApplyImage && (
                <button
                  onClick={(e) => { e.stopPropagation(); onApplyImage(src); }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-800 shadow-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  보드에 적용
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="p-1.5 rounded-lg text-xs bg-white text-gray-500 shadow-lg hover:bg-gray-100 transition-all"
                title="이미지 교체"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span className="text-xs text-gray-400 text-center leading-relaxed">이미지 업로드</span>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>
      {src && onApplyImage && (
        <button
          onClick={() => onApplyImage(src)}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center justify-end gap-0.5"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          보드에 적용
        </button>
      )}
    </div>
  );
};

// 접었다 펼 수 있는 아이디어 블록 헤더
const CollapsibleBlock: React.FC<{
  label: string;       // "A", "B" 등
  name: string;        // 아이디어명
  badge?: { bg: string; text: string };
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ label, name, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-4 last:mb-0">
      {/* 헤더 (클릭 토글) */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors select-none"
        style={{ backgroundColor: open ? "#F6F7F9" : "white" }}
      >
        <span className="text-xs font-bold text-gray-500 flex-shrink-0">{label}</span>
        <span className="text-xs font-bold text-gray-800 flex-1 text-left truncate">{name}</span>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: badge.bg, color: badge.text }}>
            아이디어 {label}
          </span>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {/* 내용 */}
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
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
          <CollapsibleBlock
            key={i}
            label={String.fromCharCode(65 + i)}
            name={idea.name}
            badge={IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length]}
          >
            {/* 이미지 (상단) */}
            <IdeaImage alt={idea.name}
              onApplyImage={onApplyImage ? (url) => onApplyImage(idea.name, url) : undefined} />

            {/* 효과 목록 + 유사 사례 */}
            <div className="space-y-2 mt-2">
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
          </CollapsibleBlock>
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
            <CollapsibleBlock key={idea.id} label={label} name={idea.name} badge={badge}>
              <DraggableCard title={idea.name} content={ideaSummary} snapshot={{ agentType: 'attribute', itemData: { ...idea, index: idx } }} onAdd={onAddIdea}>
                <div>
                  {/* 이미지 (상단) */}
                  <IdeaImage alt={idea.name} blue
                    onApplyImage={onApplyImage ? (url) => onApplyImage(idea.name, url) : undefined} />

                  <div className="grid grid-cols-2 gap-2 mt-2">
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
                                    className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 leading-relaxed">
                                    {evText}
                                  </a>
                                ) : (
                                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
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
                                    className="text-xs text-green-700 hover:text-green-800 hover:underline mt-0.5 leading-relaxed">
                                    {evText}
                                  </a>
                                ) : (
                                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
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
              </DraggableCard>
            </CollapsibleBlock>
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

// 점수 0-100 범위 보정
const clampScore = (v: unknown): number => Math.max(0, Math.min(100, Number(v) || 0));

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

        <div className="mb-5">
          {result.ideas.map((idea, i) => {
            const src = sources && sources.length > 0 ? sources[i % sources.length] : null;
            const badge = IDEA_BADGE_COLORS[i % Object.keys(IDEA_BADGE_COLORS).length];
            return (
              <CollapsibleBlock key={i} label={String.fromCharCode(65 + i)} name={idea.name} badge={badge}>
                <DraggableCard title={idea.name} content={idea.name} snapshot={{ agentType: 'guide', itemData: { ...idea, index: i, score: (idea as any).score } }} onAdd={onAddIdea}>
                  <div className="space-y-2">
                    {src && <div className="flex justify-end"><SrcLink source={src} label={`${i % sources!.length + 1}`} /></div>}
                    {[
                      { label: "실현 가능성", val: clampScore(idea.feasibility), color: "#4F48ED" },
                      { label: "사용자 편의", val: clampScore(idea.userExperience), color: "#eab308" },
                      { label: "주제 차별성", val: clampScore(idea.uniqueness), color: clampScore(idea.uniqueness) >= 50 ? "#16a34a" : "#ef4444" },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className="text-xs font-semibold" style={{ color }}>{val}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all"
                            style={{ width: `${val}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </DraggableCard>
              </CollapsibleBlock>
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
                      {c.winner}안 우위
                    </a>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: IDEA_BADGE_COLORS[winnerIdx % Object.keys(IDEA_BADGE_COLORS).length]?.text || "#374151" }}>{c.winner}안 우위</span>
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

      <div className="grid grid-cols-2 gap-3 mb-4">
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
                {[
                  { label: "실현 가능성", val: clampScore(idea.feasibility), color: "#4F48ED" },
                  { label: "사용자 편의", val: clampScore(idea.userExperience), color: "#eab308" },
                  { label: "차별성", val: clampScore(idea.uniqueness), color: clampScore(idea.uniqueness) >= 50 ? "#16a34a" : "#ef4444" },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-medium" style={{ color }}>{val}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: color }} />
                    </div>
                  </div>
                ))}
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
