import React, { useState, useRef, useCallback, useEffect } from "react";
import { Idea, IdeaCategory, IDEA_CATEGORIES, IdeaAttachment, CARD_COLORS, BoardSection, AgentType, AGENT_OPTIONS } from "../types";
import IdeaCard from "./IdeaCard";
import BoardResultCard from "./BoardResultCard";
import AddIdeaModal from "./AddIdeaModal";

const CARD_WIDTH = 240;
const COLS = 3;
const COL_GAP = 24;
const ROW_GAP = 16;

const SECTION_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];

function getDefaultPosition(index: number) {
  return {
    x: 60 + (index % COLS) * (CARD_WIDTH + COL_GAP),
    y: 60 + Math.floor(index / COLS) * (210 + ROW_GAP),
  };
}

interface BoardProps {
  ideas: Idea[];
  userName: string;
  roomId: string;
  users: { name: string; color: string }[];
  topic: string;
  onTopicChange: (topic: string) => void;
  onAddIdea: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[], snapshot?: import("../types").AnalysisSnapshot) => void;
  onDeleteIdea: (id: string) => void;
  onEditIdea: (id: string, title: string, content: string, category: IdeaCategory, color: string) => void;
  onAddComment: (ideaId: string, text: string) => void;
  selectedCategory: IdeaCategory | "all";
  onCategoryChange: (category: IdeaCategory | "all") => void;
  onSectionAnalysis?: (ideas: Idea[], agentType: AgentType) => void;
}

const Board: React.FC<BoardProps> = ({
  ideas,
  userName: _userName,
  roomId: _roomId,
  users: _users,
  topic,
  onTopicChange,
  onAddIdea,
  onDeleteIdea,
  onEditIdea,
  onAddComment,
  selectedCategory,
  onCategoryChange: _onCategoryChange,
  onSectionAnalysis,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [localTopic, setLocalTopic] = useState(topic);

  // 캔버스 상태
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // 카드 위치 (id → {x, y})
  const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>({});

  // 드래그 상태 (ref → 렌더 최소화)
  const dragState = useRef<{
    type: "canvas" | "card";
    cardId?: string;
    startMouseX: number;
    startMouseY: number;
    startValX: number;
    startValY: number;
    moved: boolean;
  } | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 섹션 상태
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [isSectionMode, setIsSectionMode] = useState(false);
  const [drawingPreview, setDrawingPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [sectionAgentSelector, setSectionAgentSelector] = useState<string | null>(null);
  const sectionDrawState = useRef<{
    startClientX: number;
    startClientY: number;
    canvasOffsetX: number;
    canvasOffsetY: number;
    canvasLeft: number;
    canvasTop: number;
  } | null>(null);

  // 에이전트 드롭 위치 (다음 추가될 카드에 적용)
  const pendingDropPos = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalTopic(topic); }, [topic]);

  // Escape → 섹션 모드 종료
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSectionMode(false);
        sectionDrawState.current = null;
        setDrawingPreview(null);
        setSectionAgentSelector(null);
        setEditingSectionId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 새 카드 위치 자동 할당
  useEffect(() => {
    setCardPositions(prev => {
      const next = { ...prev };
      let changed = false;
      ideas.forEach((idea, index) => {
        if (!next[idea.id]) {
          next[idea.id] = pendingDropPos.current
            ? (() => { const p = pendingDropPos.current!; pendingDropPos.current = null; return p; })()
            : getDefaultPosition(index);
          changed = true;
        }
      });
      // 삭제된 카드 정리
      Object.keys(next).forEach(id => {
        if (!ideas.find(i => i.id === id)) { delete next[id]; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [ideas]);

  const getCardPos = useCallback((id: string, globalIndex: number) =>
    cardPositions[id] ?? getDefaultPosition(globalIndex),
  [cardPositions]);

  // 카드가 섹션 내에 있는지 여부
  const isCardInSection = (idea: Idea, section: BoardSection): boolean => {
    const idx = ideas.indexOf(idea);
    const pos = cardPositions[idea.id] ?? getDefaultPosition(idx);
    const cx = pos.x + CARD_WIDTH / 2;
    const cy = pos.y + 100;
    return (
      cx >= section.x && cx <= section.x + section.width &&
      cy >= section.y && cy <= section.y + section.height
    );
  };

  // 휠 줌 (마우스 위치 기준)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(prev => {
      const nz = Math.max(0.2, Math.min(3, prev * factor));
      setOffset(o => ({
        x: mx - (mx - o.x) * (nz / prev),
        y: my - (my - o.y) * (nz / prev),
      }));
      return nz;
    });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // 캔버스 포인터 다운 (패닝 or 섹션 그리기)
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-card-wrapper]")) return;
    if (target.closest("[data-toolbar]")) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    if (isSectionMode) {
      // 섹션 그리기 시작
      const rect = canvasRef.current!.getBoundingClientRect();
      sectionDrawState.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        canvasOffsetX: offset.x,
        canvasOffsetY: offset.y,
        canvasLeft: rect.left,
        canvasTop: rect.top,
      };
      return;
    }

    dragState.current = {
      type: "canvas",
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: offset.x,
      startValY: offset.y,
      moved: false,
    };
    setIsPanning(true);
  }, [offset, isSectionMode]);

  // 카드 드래그 핸들 클릭
  const startCardDrag = useCallback((e: React.PointerEvent, cardId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = ideas.findIndex(i => i.id === cardId);
    const pos = cardPositions[cardId] ?? getDefaultPosition(idx);
    dragState.current = {
      type: "card",
      cardId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: pos.x,
      startValY: pos.y,
      moved: false,
    };
    setActiveDragId(cardId);
  }, [cardPositions, ideas]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // 섹션 그리기 중
    if (sectionDrawState.current) {
      const s = sectionDrawState.current;
      const startCX = (s.startClientX - s.canvasLeft - s.canvasOffsetX) / zoom;
      const startCY = (s.startClientY - s.canvasTop - s.canvasOffsetY) / zoom;
      const curCX = (e.clientX - s.canvasLeft - s.canvasOffsetX) / zoom;
      const curCY = (e.clientY - s.canvasTop - s.canvasOffsetY) / zoom;
      setDrawingPreview({
        x: Math.min(startCX, curCX),
        y: Math.min(startCY, curCY),
        w: Math.abs(curCX - startCX),
        h: Math.abs(curCY - startCY),
      });
      return;
    }

    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startMouseX;
    const dy = e.clientY - dragState.current.startMouseY;
    if (!dragState.current.moved && Math.sqrt(dx * dx + dy * dy) < 4) return;
    dragState.current.moved = true;

    if (dragState.current.type === "canvas") {
      setOffset({ x: dragState.current.startValX + dx, y: dragState.current.startValY + dy });
    } else if (dragState.current.cardId) {
      setCardPositions(prev => ({
        ...prev,
        [dragState.current!.cardId!]: {
          x: dragState.current!.startValX + dx / zoom,
          y: dragState.current!.startValY + dy / zoom,
        },
      }));
    }
  }, [zoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // 섹션 그리기 완료
    if (sectionDrawState.current) {
      const s = sectionDrawState.current;
      const startCX = (s.startClientX - s.canvasLeft - s.canvasOffsetX) / zoom;
      const startCY = (s.startClientY - s.canvasTop - s.canvasOffsetY) / zoom;
      const curCX = (e.clientX - s.canvasLeft - s.canvasOffsetX) / zoom;
      const curCY = (e.clientY - s.canvasTop - s.canvasOffsetY) / zoom;
      const x = Math.min(startCX, curCX);
      const y = Math.min(startCY, curCY);
      const w = Math.abs(curCX - startCX);
      const h = Math.abs(curCY - startCY);
      if (w > 60 && h > 60) {
        const newId = `section-${Date.now()}`;
        setSections(prev => [...prev, {
          id: newId,
          title: "새 섹션",
          color: SECTION_COLORS[prev.length % SECTION_COLORS.length],
          x, y, width: w, height: h,
        }]);
        setEditingSectionId(newId);
        setEditingSectionTitle("새 섹션");
      }
      sectionDrawState.current = null;
      setDrawingPreview(null);
      setIsSectionMode(false);
      return;
    }

    dragState.current = null;
    setActiveDragId(null);
    setIsPanning(false);
  }, [zoom]);

  const handlePointerLeave = useCallback(() => {
    if (sectionDrawState.current) {
      sectionDrawState.current = null;
      setDrawingPreview(null);
      return;
    }
    dragState.current = null;
    setActiveDragId(null);
    setIsPanning(false);
  }, []);

  // 에이전트 결과 드롭
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/agent-idea")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/agent-idea");
    if (!raw) return;
    try {
      const { title, content, snapshot } = JSON.parse(raw);
      const rect = canvasRef.current!.getBoundingClientRect();
      pendingDropPos.current = {
        x: (e.clientX - rect.left - offset.x) / zoom - CARD_WIDTH / 2,
        y: (e.clientY - rect.top - offset.y) / zoom - 70,
      };
      onAddIdea(title, content, CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)], "ai", [], snapshot);
    } catch { /* ignore */ }
  };

  const filteredIdeas = selectedCategory === "all"
    ? ideas
    : ideas.filter(i => (i.category ?? "brainstorm") === selectedCategory);

  const handleTopicBlur = () => { setEditingTopic(false); onTopicChange(localTopic); };
  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setEditingTopic(false); onTopicChange(localTopic); }
  };
  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-col h-full">
      {selectedCategory === "all" ? (
        /* ── 전체: 피그마 캔버스 ── */
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden"
          style={{
            backgroundColor: "#f0ede8",
            backgroundImage: "radial-gradient(circle, #c9c5bc 1px, transparent 1px)",
            backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
            backgroundPosition: `${offset.x % (28 * zoom)}px ${offset.y % (28 * zoom)}px`,
            cursor: isSectionMode
              ? "crosshair"
              : isPanning ? "grabbing"
              : activeDragId ? "grabbing"
              : "default",
            userSelect: "none",
          }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 주제 입력 오버레이 (캔버스 상단 왼쪽) */}
          <div data-toolbar className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <span className="text-gray-300">📎</span>
            {editingTopic ? (
              <input
                autoFocus
                type="text"
                value={localTopic}
                onChange={e => setLocalTopic(e.target.value)}
                onBlur={handleTopicBlur}
                onKeyDown={handleTopicKeyDown}
                className="text-sm border-0 border-b border-gray-300 focus:outline-none focus:border-violet-400 bg-transparent text-gray-700 w-64 pb-0.5"
              />
            ) : (
              <button
                onClick={() => setEditingTopic(true)}
                className={`text-sm bg-transparent border-0 ${localTopic ? "text-gray-600 font-medium" : "text-gray-400"}`}
              >
                {localTopic || "회의 주제를 입력해주세요"}
              </button>
            )}
          </div>

          {/* 섹션 모드 안내 배너 */}
          {isSectionMode && (
            <div data-toolbar className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
              빈 캔버스를 드래그해서 섹션을 만드세요
              <button
                onClick={() => { setIsSectionMode(false); sectionDrawState.current = null; setDrawingPreview(null); }}
                className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          <div style={{
            position: "absolute",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0, height: 0,
          }}>
            {/* ── 섹션 프레임 (카드 아래에 렌더) ── */}
            {sections.map(section => {
              const cardsInSection = ideas.filter(idea => isCardInSection(idea, section));
              const hex = section.color;

              return (
                <div key={section.id} className="absolute"
                  style={{
                    left: section.x, top: section.y,
                    width: section.width, height: section.height,
                    border: `2px solid ${hex}`,
                    borderRadius: 12,
                    backgroundColor: hex + "15",
                  }}>
                  {/* 섹션 헤더 */}
                  <div data-toolbar className="flex items-center gap-1.5 px-3 py-2 rounded-t-xl select-none"
                    style={{ backgroundColor: hex + "30" }}>
                    {/* 타이틀 */}
                    {editingSectionId === section.id ? (
                      <input
                        autoFocus
                        value={editingSectionTitle}
                        onChange={e => setEditingSectionTitle(e.target.value)}
                        onBlur={() => {
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: editingSectionTitle || "섹션" } : s));
                          setEditingSectionId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: editingSectionTitle || "섹션" } : s));
                            setEditingSectionId(null);
                          }
                          if (e.key === "Escape") setEditingSectionId(null);
                        }}
                        className="text-xs font-semibold bg-transparent border-b border-current outline-none min-w-0 flex-1"
                        style={{ color: hex }}
                      />
                    ) : (
                      <button
                        className="text-xs font-bold truncate max-w-[120px] hover:underline"
                        style={{ color: hex }}
                        onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}
                        title="클릭해서 제목 수정"
                      >
                        {section.title}
                      </button>
                    )}
                    <span className="text-xs font-medium ml-0.5" style={{ color: hex + "bb" }}>
                      {cardsInSection.length}개
                    </span>

                    <div className="flex-1" />

                    {/* AI 분석 버튼 */}
                    <div className="relative">
                      <button
                        title="이 섹션 AI 분석"
                        onClick={() => setSectionAgentSelector(sectionAgentSelector === section.id ? null : section.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
                        style={{ backgroundColor: hex }}
                      >
                        <span>🤖</span>
                        <span>분석</span>
                      </button>

                      {/* 에이전트 선택 드롭다운 */}
                      {sectionAgentSelector === section.id && (
                        <div
                          className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 w-52"
                          style={{ minWidth: 200 }}
                        >
                          <div className="text-xs font-semibold text-gray-400 px-2 py-1 mb-1">분석 방식 선택</div>
                          {AGENT_OPTIONS.map(agent => (
                            <button
                              key={agent.type}
                              onClick={() => {
                                const inSection = ideas.filter(idea => isCardInSection(idea, section));
                                if (inSection.length === 0) {
                                  alert("섹션 안에 카드가 없어요. 카드를 섹션 영역 안으로 이동해보세요.");
                                  return;
                                }
                                onSectionAnalysis?.(inSection, agent.type);
                                setSectionAgentSelector(null);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-50 transition-colors flex items-start gap-2"
                            >
                              <span className="text-base flex-shrink-0 mt-0.5">{agent.emoji}</span>
                              <div>
                                <div className="text-xs font-semibold text-gray-800">{agent.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{agent.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      title="섹션 삭제"
                      onClick={() => setSections(prev => prev.filter(s => s.id !== section.id))}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all ml-0.5"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 섹션 그리기 미리보기 */}
            {drawingPreview && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: drawingPreview.x, top: drawingPreview.y,
                  width: drawingPreview.w, height: drawingPreview.h,
                  border: "2px dashed #6366f1",
                  borderRadius: 8,
                  backgroundColor: "rgba(99, 102, 241, 0.07)",
                }}
              />
            )}

            {/* ── 아이디어 카드 ── */}
            {ideas.map((idea) => {
              const globalIndex = ideas.indexOf(idea);
              const pos = getCardPos(idea.id, globalIndex);
              const isActive = activeDragId === idea.id;
              return (
                <div key={idea.id} data-card-wrapper="true" className="absolute group"
                  style={{
                    left: pos.x, top: pos.y, width: CARD_WIDTH,
                    zIndex: isActive ? 1000 : 1,
                    filter: isActive ? "drop-shadow(0 12px 20px rgba(0,0,0,0.25))" : "none",
                    transition: isActive ? "none" : "filter 0.2s",
                  }}>
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 h-3 w-12 rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all z-10 flex items-center justify-center gap-0.5"
                    style={{ backgroundColor: isActive ? "#6366f1" : "#d1d5db" }}
                    onPointerDown={e => startCardDrag(e, idea.id)}
                    title="드래그해서 이동"
                  >
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-0.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? "white" : "#6b7280" }} />
                    ))}
                  </div>
                  {idea.analysisSnapshot
                    ? <BoardResultCard idea={idea} onDelete={onDeleteIdea} />
                    : <IdeaCard idea={idea} onDelete={onDeleteIdea} onEdit={onEditIdea} onAddComment={onAddComment} />
                  }
                </div>
              );
            })}
          </div>

          {isDragOver && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              <div className="border-2 border-dashed border-indigo-400 rounded-2xl bg-indigo-50 bg-opacity-90 px-8 py-5 flex flex-col items-center gap-2 shadow-lg">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
                <p className="text-sm font-semibold text-indigo-600">캔버스에 놓으면 카드로 추가돼요</p>
              </div>
            </div>
          )}

          {ideas.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center mb-3 shadow-sm">
                <span className="text-3xl">💡</span>
              </div>
              <p className="text-gray-500 font-medium mb-1">아직 아이디어가 없어요</p>
              <p className="text-gray-400 text-sm">오른쪽 하단 버튼으로 추가해보세요!</p>
            </div>
          )}

          {/* ── 좌하단: 줌 컨트롤 ── */}
          <div data-toolbar className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-1 py-1 flex items-center gap-0.5">
              <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))}
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-lg font-bold leading-none transition-colors">−</button>
              <button onClick={resetView}
                className="text-xs text-gray-600 hover:text-gray-900 font-mono w-12 text-center py-0.5 hover:bg-gray-100 rounded-lg transition-colors">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom(z => Math.min(3, z * 1.25))}
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-lg font-bold leading-none transition-colors">+</button>
            </div>
          </div>

          {/* ── 하단 중앙: 아이디어 추가 + 섹션 추가 버튼 ── */}
          <div data-toolbar className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-full text-sm font-semibold shadow-lg transition-all"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              아이디어 추가
            </button>
            <button
              onClick={() => setIsSectionMode(v => !v)}
              title="섹션 그리기 (드래그로 영역 지정)"
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold shadow-md border transition-all ${
                isSectionMode
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" strokeDasharray="3 2" />
                <line x1="3" y1="15" x2="21" y2="15" strokeDasharray="3 2" />
              </svg>
              섹션 추가
            </button>
          </div>
        </div>
      ) : (
        /* ── 카테고리 선택: 정렬 그리드 뷰 ── */
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f4f3ef" }}>
          {filteredIdeas.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-sm"
                style={{ backgroundColor: IDEA_CATEGORIES.find(c => c.id === selectedCategory)?.bg ?? "#f3f4f6" }}>
                <span className="text-3xl">{IDEA_CATEGORIES.find(c => c.id === selectedCategory)?.emoji ?? "💡"}</span>
              </div>
              <p className="text-gray-500 font-medium mb-1">
                '{IDEA_CATEGORIES.find(c => c.id === selectedCategory)?.label}' 아이디어가 없어요
              </p>
              <p className="text-gray-400 text-sm mb-4">이 카테고리로 아이디어를 추가해보세요</p>
              <button onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-all">
                + 아이디어 추가
              </button>
            </div>
          ) : (
            <div className="p-6">
              {(() => {
                const cat = IDEA_CATEGORIES.find(c => c.id === selectedCategory);
                return cat ? (
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-lg">{cat.emoji}</span>
                    <h2 className="text-base font-bold" style={{ color: cat.text }}>{cat.label}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: cat.bg, color: cat.text }}>
                      {filteredIdeas.length}개
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredIdeas.map(idea =>
                  idea.analysisSnapshot
                    ? <BoardResultCard key={idea.id} idea={idea} onDelete={onDeleteIdea} />
                    : <IdeaCard key={idea.id} idea={idea} onDelete={onDeleteIdea} onEdit={onEditIdea} onAddComment={onAddComment} />
                )}
                <button onClick={() => setShowModal(true)}
                  className="rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 min-h-[140px] flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500 transition-all group">
                  <div className="w-9 h-9 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium">아이디어 추가</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <AddIdeaModal
          onClose={() => setShowModal(false)}
          onAdd={onAddIdea}
          defaultCategory={selectedCategory === "all" ? "brainstorm" : selectedCategory}
        />
      )}
    </div>
  );
};

export default Board;
