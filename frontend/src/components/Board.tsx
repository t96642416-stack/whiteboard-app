import React, { useState, useRef, useCallback, useEffect } from "react";
import { Idea, IdeaCategory, IDEA_CATEGORIES, IdeaAttachment, CARD_COLORS } from "../types";
import IdeaCard from "./IdeaCard";
import AddIdeaModal from "./AddIdeaModal";

const CARD_WIDTH = 240;
const COLS = 3;
const COL_GAP = 24;
const ROW_GAP = 16;

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
  onAddIdea: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[]) => void;
  onDeleteIdea: (id: string) => void;
  onEditIdea: (id: string, title: string, content: string, category: IdeaCategory) => void;
  onAddComment: (ideaId: string, text: string) => void;
  selectedCategory: IdeaCategory | "all";
  onCategoryChange: (category: IdeaCategory | "all") => void;
}

const Board: React.FC<BoardProps> = ({
  ideas,
  userName,
  roomId,
  users,
  topic,
  onTopicChange,
  onAddIdea,
  onDeleteIdea,
  onEditIdea,
  onAddComment,
  selectedCategory,
  onCategoryChange,
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

  // 에이전트 드롭 위치 (다음 추가될 카드에 적용)
  const pendingDropPos = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalTopic(topic); }, [topic]);

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

  // 빈 캔버스 클릭 → 패닝
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-card-wrapper]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      type: "canvas",
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: offset.x,
      startValY: offset.y,
      moved: false,
    };
    setIsPanning(true);
  }, [offset]);

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

  const handlePointerUp = useCallback(() => {
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
      const { title, content } = JSON.parse(raw);
      const rect = canvasRef.current!.getBoundingClientRect();
      pendingDropPos.current = {
        x: (e.clientX - rect.left - offset.x) / zoom - CARD_WIDTH / 2,
        y: (e.clientY - rect.top - offset.y) / zoom - 70,
      };
      onAddIdea(title, content, CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)], "ai", []);
    } catch { /* ignore */ }
  };

  const filteredIdeas = selectedCategory === "all"
    ? ideas
    : ideas.filter(i => (i.category ?? "brainstorm") === selectedCategory);

  const countByCategory = (catId: string) =>
    catId === "all" ? ideas.length : ideas.filter(i => (i.category ?? "brainstorm") === catId).length;

  const handleTopicBlur = () => { setEditingTopic(false); onTopicChange(localTopic); };
  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setEditingTopic(false); onTopicChange(localTopic); }
  };
  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-col h-full">
      {/* ── 상단 헤더 ── */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-base font-bold text-blue-600 tracking-tight whitespace-nowrap">협업 화이트보드</h1>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500 font-mono">{roomId}</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-500">{users.length}명 접속 중</span>
              </div>
              <div className="flex items-center gap-0.5">
                {users.slice(0, 5).map(u => (
                  <div key={u.name} title={u.name}
                    className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-sm -ml-1 first:ml-0"
                    style={{ backgroundColor: u.color, color: u.color === "#E5E7EB" ? "#374151" : "white" }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {users.length > 5 && <span className="text-xs text-gray-400 ml-1">+{users.length - 5}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">📌</span>
              {editingTopic ? (
                <input autoFocus type="text" value={localTopic}
                  onChange={e => setLocalTopic(e.target.value)}
                  onBlur={handleTopicBlur} onKeyDown={handleTopicKeyDown}
                  className="px-2 py-0.5 text-sm border border-blue-400 rounded focus:outline-none text-gray-800 w-64" />
              ) : (
                <button onClick={() => setEditingTopic(true)}
                  className={`text-sm transition-colors ${localTopic ? "text-gray-700 font-medium hover:text-blue-600" : "text-gray-400 hover:text-blue-500"}`}>
                  {localTopic || "회의 주제를 입력하세요..."}
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-all flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            아이디어 추가
          </button>
        </div>
      </div>

      {/* ── 카테고리 필터 탭 (상단 고정) ── */}
      <div className="px-5 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => onCategoryChange("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === "all"
                ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
            }`}
          >
            전체
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              selectedCategory === "all" ? "bg-white bg-opacity-20 text-white" : "bg-gray-100 text-gray-500"
            }`}>{ideas.length}</span>
          </button>
          {IDEA_CATEGORIES.map(cat => {
            const count = countByCategory(cat.id);
            const isActive = selectedCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => onCategoryChange(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border"
                style={{
                  backgroundColor: isActive ? cat.bg : "white",
                  color: isActive ? cat.text : "#6b7280",
                  borderColor: isActive ? cat.border : "#e5e7eb",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                {cat.emoji} {cat.label}
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: isActive ? "rgba(0,0,0,0.1)" : "#f3f4f6",
                    color: isActive ? cat.text : "#9ca3af",
                  }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 피그마 캔버스 ── */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundColor: "#f0ede8",
          backgroundImage: "radial-gradient(circle, #c9c5bc 1px, transparent 1px)",
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${offset.x % (28 * zoom)}px ${offset.y % (28 * zoom)}px`,
          cursor: isPanning ? "grabbing" : activeDragId ? "grabbing" : "default",
          userSelect: "none",
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 카드 레이어 */}
        <div
          style={{
            position: "absolute",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0,
            height: 0,
          }}
        >
          {filteredIdeas.map((idea) => {
            const globalIndex = ideas.indexOf(idea);
            const pos = getCardPos(idea.id, globalIndex);
            const isActive = activeDragId === idea.id;
            return (
              <div
                key={idea.id}
                data-card-wrapper="true"
                className="absolute group"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: CARD_WIDTH,
                  zIndex: isActive ? 1000 : 1,
                  filter: isActive ? "drop-shadow(0 12px 20px rgba(0,0,0,0.25))" : "none",
                  transition: isActive ? "none" : "filter 0.2s",
                }}
              >
                {/* ✥ 드래그 핸들 */}
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
                <IdeaCard idea={idea} onDelete={onDeleteIdea} onEdit={onEditIdea} onAddComment={onAddComment} />
              </div>
            );
          })}
        </div>

        {/* 에이전트 드롭 오버레이 */}
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

        {/* 빈 상태 */}
        {filteredIdeas.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center mb-3 shadow-sm">
              <span className="text-3xl">
                {selectedCategory === "all" ? "💡" : IDEA_CATEGORIES.find(c => c.id === selectedCategory)?.emoji ?? "💡"}
              </span>
            </div>
            <p className="text-gray-500 font-medium mb-1">아직 아이디어가 없어요</p>
            <p className="text-gray-400 text-sm">오른쪽 상단 버튼으로 추가해보세요!</p>
          </div>
        )}

        {/* ── 우하단: 줌 컨트롤 ── */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <div className="text-xs text-gray-400 bg-white bg-opacity-90 rounded-xl px-2.5 py-1.5 shadow-sm border border-gray-100">
            {userName} · {ideas.length}개
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-1 py-1 flex items-center gap-0.5">
            <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-lg font-bold leading-none transition-colors">
              −
            </button>
            <button onClick={resetView}
              className="text-xs text-gray-600 hover:text-gray-900 font-mono w-12 text-center py-0.5 hover:bg-gray-100 rounded-lg transition-colors">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(z => Math.min(3, z * 1.25))}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-lg font-bold leading-none transition-colors">
              +
            </button>
          </div>
        </div>
      </div>

      {showModal && <AddIdeaModal onClose={() => setShowModal(false)} onAdd={onAddIdea} />}
    </div>
  );
};

export default Board;
