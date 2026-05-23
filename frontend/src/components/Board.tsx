import React, { useState, useRef, useCallback, useEffect } from "react";
import { Idea, IdeaCategory, IdeaAttachment, CARD_COLORS, BoardSection, AgentType, AGENT_OPTIONS, CanvasImage, AnalysisFile } from "../types";
import IdeaCard from "./IdeaCard";
import BoardResultCard from "./BoardResultCard";
import AddIdeaModal from "./AddIdeaModal";

const CARD_WIDTH = 240;
const COLS = 3;
const COL_GAP = 24;
const ROW_GAP = 16;

const SECTION_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#4F48ED", "#8b5cf6"];

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
  onTopicFilesChange?: (files: AnalysisFile[]) => void;
  onAddIdea: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[], snapshot?: import("../types").AnalysisSnapshot) => void;
  onDeleteIdea: (id: string) => void;
  onEditIdea: (id: string, title: string, content: string, category: IdeaCategory, color: string, attachments?: IdeaAttachment[]) => void;
  onAddComment: (ideaId: string, text: string) => void;
  onSectionAnalysis?: (ideas: Idea[], agentType: AgentType) => void;
}

const Board: React.FC<BoardProps> = ({
  ideas,
  userName,
  roomId,
  users,
  topic,
  onTopicChange,
  onTopicFilesChange,
  onAddIdea,
  onDeleteIdea,
  onEditIdea,
  onAddComment,
  onSectionAnalysis,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [localTopic, setLocalTopic] = useState(topic);
  const [topicFiles, setTopicFiles] = useState<AnalysisFile[]>([]);
  const topicFileInputRef = useRef<HTMLInputElement>(null);

  // 캔버스 상태
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // 카드 위치 (id → {x, y})
  const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>({});

  // 드래그 상태 (ref → 렌더 최소화)
  const dragState = useRef<{
    type: "canvas" | "card" | "image" | "section-resize" | "image-resize";
    cardId?: string;
    imageId?: string;
    sectionId?: string;
    resizeDir?: string; // "nw"|"n"|"ne"|"e"|"se"|"s"|"sw"|"w"
    startMouseX: number;
    startMouseY: number;
    startValX: number;
    startValY: number;
    startWidth?: number;
    startHeight?: number;
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

  // 멀티 선택 상태
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectBox, setSelectBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionAgentSelector, setSelectionAgentSelector] = useState(false);
  const selectBoxStartRef = useRef<{
    clientX: number;
    clientY: number;
    canvasLeft: number;
    canvasTop: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // 캔버스 이미지 상태
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const canvasImageInputRef = useRef<HTMLInputElement>(null);

  // 에이전트 드롭 위치 (다음 추가될 카드에 적용)
  const pendingDropPos = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalTopic(topic); }, [topic]);

  // Escape → 모드 종료
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSectionMode(false);
        sectionDrawState.current = null;
        setDrawingPreview(null);
        setSectionAgentSelector(null);
        setEditingSectionId(null);
        setIsSelectMode(false);
        selectBoxStartRef.current = null;
        setSelectBox(null);
        setSelectedIds(new Set());
        setSelectionAgentSelector(false);
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

  // 캔버스 포인터 다운
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-card-wrapper]")) return;
    if (target.closest("[data-toolbar]")) return;
    if (target.closest("[data-canvas-image-wrapper]")) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    if (isSectionMode) {
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

    if (isSelectMode) {
      const rect = canvasRef.current!.getBoundingClientRect();
      selectBoxStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasLeft: rect.left,
        canvasTop: rect.top,
        offsetX: offset.x,
        offsetY: offset.y,
      };
      setSelectBox(null);
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
  }, [offset, isSectionMode, isSelectMode]);

  // 카드 드래그
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

  // 캔버스 이미지 드래그
  const startImageDrag = useCallback((e: React.PointerEvent, img: CanvasImage) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      type: "image",
      imageId: img.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: img.x,
      startValY: img.y,
      moved: false,
    };
  }, []);

  // 섹션 리사이즈
  const startSectionResize = useCallback((e: React.PointerEvent, section: BoardSection, dir: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      type: "section-resize",
      sectionId: section.id,
      resizeDir: dir,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: section.x,
      startValY: section.y,
      startWidth: section.width,
      startHeight: section.height,
      moved: false,
    };
  }, []);

  // 캔버스 이미지 리사이즈
  const startImageResize = useCallback((e: React.PointerEvent, img: CanvasImage, dir: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      type: "image-resize",
      imageId: img.id,
      resizeDir: dir,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startValX: img.x,
      startValY: img.y,
      startWidth: img.width,
      startHeight: img.height,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // 선택 박스 그리기
    if (selectBoxStartRef.current) {
      const s = selectBoxStartRef.current;
      const startWX = (s.clientX - s.canvasLeft - s.offsetX) / zoom;
      const startWY = (s.clientY - s.canvasTop - s.offsetY) / zoom;
      const curWX = (e.clientX - s.canvasLeft - s.offsetX) / zoom;
      const curWY = (e.clientY - s.canvasTop - s.offsetY) / zoom;
      setSelectBox({
        x: Math.min(startWX, curWX),
        y: Math.min(startWY, curWY),
        w: Math.abs(curWX - startWX),
        h: Math.abs(curWY - startWY),
      });
      return;
    }

    // 섹션 그리기
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
    } else if (dragState.current.type === "card" && dragState.current.cardId) {
      setCardPositions(prev => ({
        ...prev,
        [dragState.current!.cardId!]: {
          x: dragState.current!.startValX + dx / zoom,
          y: dragState.current!.startValY + dy / zoom,
        },
      }));
    } else if (dragState.current.type === "image" && dragState.current.imageId) {
      const id = dragState.current.imageId;
      setCanvasImages(prev => prev.map(img =>
        img.id === id
          ? { ...img, x: dragState.current!.startValX + dx / zoom, y: dragState.current!.startValY + dy / zoom }
          : img
      ));
    } else if (dragState.current.type === "section-resize" && dragState.current.sectionId) {
      const d = dragState.current;
      const wdx = dx / zoom;
      const wdy = dy / zoom;
      const dir = d.resizeDir!;
      const MIN_W = 80, MIN_H = 60;
      setSections(prev => prev.map(s => {
        if (s.id !== d.sectionId) return s;
        let { x, y, width, height } = { x: d.startValX, y: d.startValY, width: d.startWidth!, height: d.startHeight! };
        if (dir.includes("e")) width  = Math.max(MIN_W, width  + wdx);
        if (dir.includes("s")) height = Math.max(MIN_H, height + wdy);
        if (dir.includes("w")) { const nw = Math.max(MIN_W, width - wdx); x += width - nw; width = nw; }
        if (dir.includes("n")) { const nh = Math.max(MIN_H, height - wdy); y += height - nh; height = nh; }
        return { ...s, x, y, width, height };
      }));
    } else if (dragState.current.type === "image-resize" && dragState.current.imageId) {
      const d = dragState.current;
      const wdx = dx / zoom;
      const wdy = dy / zoom;
      const dir = d.resizeDir!;
      const MIN_W = 40, MIN_H = 40;
      setCanvasImages(prev => prev.map(img => {
        if (img.id !== d.imageId) return img;
        let { x, y, width, height } = { x: d.startValX, y: d.startValY, width: d.startWidth!, height: d.startHeight! };
        if (dir.includes("e")) width  = Math.max(MIN_W, width  + wdx);
        if (dir.includes("s")) height = Math.max(MIN_H, height + wdy);
        if (dir.includes("w")) { const nw = Math.max(MIN_W, width - wdx); x += width - nw; width = nw; }
        if (dir.includes("n")) { const nh = Math.max(MIN_H, height - wdy); y += height - nh; height = nh; }
        return { ...img, x, y, width, height };
      }));
    }
  }, [zoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // 선택 박스 완료
    if (selectBoxStartRef.current) {
      const s = selectBoxStartRef.current;
      const dx = e.clientX - s.clientX;
      const dy = e.clientY - s.clientY;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        // 클릭만 → 선택 해제
        setSelectedIds(new Set());
      } else {
        const startWX = (s.clientX - s.canvasLeft - s.offsetX) / zoom;
        const startWY = (s.clientY - s.canvasTop - s.offsetY) / zoom;
        const curWX = (e.clientX - s.canvasLeft - s.offsetX) / zoom;
        const curWY = (e.clientY - s.canvasTop - s.offsetY) / zoom;
        const box = {
          x: Math.min(startWX, curWX),
          y: Math.min(startWY, curWY),
          w: Math.abs(curWX - startWX),
          h: Math.abs(curWY - startWY),
        };
        // 박스 안의 아이디어 선택
        const newSelected = new Set<string>();
        (window as any).__boardIdeas?.forEach((idea: Idea, index: number) => {
          const pos = (window as any).__boardCardPositions?.[idea.id] ?? getDefaultPosition(index);
          const cardCX = pos.x + CARD_WIDTH / 2;
          const cardCY = pos.y + 70;
          if (cardCX >= box.x && cardCX <= box.x + box.w &&
              cardCY >= box.y && cardCY <= box.y + box.h) {
            newSelected.add(idea.id);
          }
        });
        if (newSelected.size > 0) setSelectedIds(newSelected);
      }
      selectBoxStartRef.current = null;
      setSelectBox(null);
      return;
    }

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

  // ideas와 cardPositions를 window에 임시 저장 (handlePointerUp의 클로저 한계 우회)
  useEffect(() => {
    (window as any).__boardIdeas = ideas;
    (window as any).__boardCardPositions = cardPositions;
  }, [ideas, cardPositions]);

  const handlePointerLeave = useCallback(() => {
    if (sectionDrawState.current) {
      sectionDrawState.current = null;
      setDrawingPreview(null);
      return;
    }
    if (selectBoxStartRef.current) {
      selectBoxStartRef.current = null;
      setSelectBox(null);
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

  // 캔버스 이미지 업로드 (자연 비율 유지)
  const handleCanvasImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const imgEl = new window.Image();
      imgEl.onload = () => {
        const maxW = 600;
        const scale = imgEl.naturalWidth > maxW ? maxW / imgEl.naturalWidth : 1;
        const w = Math.round(imgEl.naturalWidth * scale);
        const h = Math.round(imgEl.naturalHeight * scale);
        const rect = canvasRef.current?.getBoundingClientRect();
        const centerX = rect ? (rect.width / 2 - offset.x) / zoom : 200;
        const centerY = rect ? (rect.height / 2 - offset.y) / zoom : 200;
        const newImg: CanvasImage = {
          id: `img-${Date.now()}`,
          src,
          x: centerX - w / 2,
          y: centerY - h / 2,
          width: w,
          height: h,
        };
        setCanvasImages(prev => [...prev, newImg]);
      };
      imgEl.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleTopicBlur = () => { setEditingTopic(false); onTopicChange(localTopic); };
  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setEditingTopic(false); onTopicChange(localTopic); }
  };

  const handleTopicFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (topicFiles.length >= 3) { alert("파일은 최대 3개까지 첨부할 수 있어요"); return; }
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name}: 5MB 이하 파일만 가능해요`); return; }
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();
      reader.onload = () => {
        setTopicFiles((prev) => {
          if (prev.length >= 3) return prev;
          const newFiles = [...prev, {
            name: file.name,
            type: isImage ? "image" : "text",
            mimeType: file.type,
            content: reader.result as string,
          } as AnalysisFile];
          onTopicFilesChange?.(newFiles);
          return newFiles;
        });
      };
      if (isImage) reader.readAsDataURL(file);
      else reader.readAsText(file, "utf-8");
    });
    e.target.value = "";
  };

  const removeTopicFile = (idx: number) => {
    setTopicFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== idx);
      onTopicFilesChange?.(newFiles);
      return newFiles;
    });
  };

  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-col h-full">
      {/* ── 상단 헤더 ── */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <a href="/" className="text-base font-bold text-blue-600 tracking-tight whitespace-nowrap hover:opacity-75 transition-opacity">협업 화이트보드</a>
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
              {/* 파일 첨부 버튼 */}
              <input ref={topicFileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,image/*" className="hidden" onChange={handleTopicFileChange} />
              <button
                onClick={() => topicFileInputRef.current?.click()}
                disabled={topicFiles.length >= 3}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 disabled:opacity-30 transition-colors ml-1"
                title="회의 참고 파일 첨부"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                {topicFiles.length === 0 ? "파일 첨부" : `${topicFiles.length}개`}
              </button>
              {/* 첨부된 파일 칩 */}
              {topicFiles.map((f, idx) => (
                <span key={idx} className="flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 text-xs">
                  {f.name.length > 12 ? f.name.slice(0, 12) + "…" : f.name}
                  <button onClick={() => removeTopicFile(idx)} className="hover:text-red-500 transition-colors ml-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
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
        </div>
      </div>

      {/* ── 피그마 캔버스 ── */}
      <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden"
          style={{
            backgroundColor: "#F6F7F9",
            backgroundImage: "radial-gradient(circle, #D1D5DB 1px, transparent 1px)",
            backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
            backgroundPosition: `${offset.x % (28 * zoom)}px ${offset.y % (28 * zoom)}px`,
            cursor: isSectionMode
              ? "crosshair"
              : isSelectMode ? "crosshair"
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

          {/* 선택 모드 안내 배너 */}
          {isSelectMode && (
            <div data-toolbar className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              드래그해서 카드를 선택하거나 카드를 클릭해서 선택하세요
              <button
                onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); setSelectBox(null); selectBoxStartRef.current = null; }}
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
            {/* ── 섹션 프레임 ── */}
            {sections.map(section => {
              const cardsInSection = ideas.filter(idea => isCardInSection(idea, section));
              const hex = section.color;

              return (
                <div key={section.id} className="absolute group/section"
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

                    {/* 섹션 선택 버튼 (선택 모드에서 섹션 통째로 선택) */}
                    {isSelectMode && cardsInSection.length > 0 && (
                      <button
                        title="섹션 전체 선택"
                        onClick={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            cardsInSection.forEach(idea => next.add(idea.id));
                            return next;
                          });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
                        style={{ backgroundColor: hex }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        선택
                      </button>
                    )}

                    <div className="flex-1" />

                    {/* AI 분석 버튼 */}
                    {!isSelectMode && (
                      <div className="relative">
                        <button
                          title="이 섹션 AI 분석"
                          onClick={() => setSectionAgentSelector(sectionAgentSelector === section.id ? null : section.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
                          style={{ backgroundColor: hex }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
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
                                <div>
                                  <div className="text-xs font-semibold text-gray-800">{agent.name}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">{agent.description}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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

                  {/* ── 리사이즈 핸들 ── */}
                  {[
                    { dir: "nw", style: { top: -5, left: -5, cursor: "nw-resize" } },
                    { dir: "n",  style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
                    { dir: "ne", style: { top: -5, right: -5, cursor: "ne-resize" } },
                    { dir: "e",  style: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "e-resize" } },
                    { dir: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
                    { dir: "s",  style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
                    { dir: "sw", style: { bottom: -5, left: -5, cursor: "sw-resize" } },
                    { dir: "w",  style: { top: "50%", left: -5, transform: "translateY(-50%)", cursor: "w-resize" } },
                  ].map(({ dir, style }) => (
                    <div
                      key={dir}
                      className="absolute w-2.5 h-2.5 rounded-sm border-2 bg-white opacity-0 group-hover/section:opacity-100 transition-opacity hover:scale-125"
                      style={{ ...style, borderColor: hex, zIndex: 10 } as React.CSSProperties}
                      onPointerDown={e => startSectionResize(e, section, dir)}
                    />
                  ))}
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

            {/* 선택 박스 미리보기 */}
            {selectBox && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: selectBox.x, top: selectBox.y,
                  width: selectBox.w, height: selectBox.h,
                  border: "2px dashed #4F48ED",
                  borderRadius: 6,
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                }}
              />
            )}

            {/* ── 캔버스 이미지 ── */}
            {canvasImages.map(img => (
              <div
                key={img.id}
                data-canvas-image-wrapper="true"
                className="absolute group/cimg"
                style={{
                  left: img.x, top: img.y,
                  width: img.width, height: img.height,
                  cursor: "grab",
                  zIndex: 2,
                }}
                onPointerDown={e => startImageDrag(e, img)}
              >
                <img
                  src={img.src}
                  alt="캔버스 이미지"
                  className="w-full h-full object-cover rounded-xl shadow-lg"
                  style={{ border: "2px solid rgba(255,255,255,0.8)" }}
                  draggable={false}
                />
                {/* 삭제 버튼 */}
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setCanvasImages(prev => prev.filter(i => i.id !== img.id))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black bg-opacity-60 text-white flex items-center justify-center opacity-0 group-hover/cimg:opacity-100 transition-opacity hover:bg-opacity-80"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                {/* 리사이즈 핸들 (8방향) */}
                {([
                  { dir: "nw", style: { top: -5, left: -5, cursor: "nw-resize" } },
                  { dir: "n",  style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
                  { dir: "ne", style: { top: -5, right: -5, cursor: "ne-resize" } },
                  { dir: "e",  style: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "e-resize" } },
                  { dir: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
                  { dir: "s",  style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
                  { dir: "sw", style: { bottom: -5, left: -5, cursor: "sw-resize" } },
                  { dir: "w",  style: { top: "50%", left: -5, transform: "translateY(-50%)", cursor: "w-resize" } },
                ] as { dir: string; style: React.CSSProperties }[]).map(({ dir, style }) => (
                  <div
                    key={dir}
                    className="absolute w-3 h-3 rounded-sm border-2 bg-white opacity-0 group-hover/cimg:opacity-100 transition-opacity hover:scale-125"
                    style={{ ...style, borderColor: "#4F48ED", zIndex: 10 } as React.CSSProperties}
                    onPointerDown={e => startImageResize(e, img, dir)}
                  />
                ))}
              </div>
            ))}

            {/* ── 아이디어 카드 ── */}
            {ideas.map((idea) => {
              const globalIndex = ideas.indexOf(idea);
              const pos = getCardPos(idea.id, globalIndex);
              const isActive = activeDragId === idea.id;
              const isSelected = selectedIds.has(idea.id);
              return (
                <div key={idea.id} data-card-wrapper="true" className="absolute group"
                  style={{
                    left: pos.x, top: pos.y, width: CARD_WIDTH,
                    zIndex: isActive ? 1000 : 1,
                    filter: isActive ? "drop-shadow(0 12px 20px rgba(0,0,0,0.25))" : "none",
                    transition: isActive ? "none" : "filter 0.2s",
                  }}>
                  {/* 드래그 핸들 (선택 모드에서는 숨김) */}
                  {!isSelectMode && (
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
                  )}

                  {/* 선택 오버레이 (선택 모드에서만) */}
                  {isSelectMode && (
                    <div
                      className="absolute inset-0 z-20 rounded-lg cursor-pointer transition-all"
                      style={{
                        border: isSelected ? "2px solid #4F48ED" : "2px solid transparent",
                        backgroundColor: isSelected ? "rgba(59,130,246,0.12)" : "transparent",
                        borderRadius: 8,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(idea.id)) next.delete(idea.id);
                          else next.add(idea.id);
                          return next;
                        });
                      }}
                    />
                  )}

                  {/* 선택 체크 표시 */}
                  {isSelectMode && isSelected && (
                    <div className="absolute -top-2 -right-2 z-30 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}

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


          {/* ── 좌하단: 줌 + 섹션 + 선택 + 이미지 버튼 ── */}
          <div data-toolbar className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            {/* 줌 컨트롤 */}
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

            {/* 섹션 그리기 버튼 */}
            <button
              onClick={() => {
                setIsSectionMode(v => !v);
                if (isSelectMode) { setIsSelectMode(false); setSelectedIds(new Set()); }
              }}
              title="섹션 그리기"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-md border transition-all ${
                isSectionMode
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-100 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" strokeDasharray="3 2" />
                <line x1="3" y1="15" x2="21" y2="15" strokeDasharray="3 2" />
              </svg>
              섹션
            </button>

            {/* 드래그 선택 버튼 */}
            <button
              onClick={() => {
                setIsSelectMode(v => {
                  if (v) { setSelectedIds(new Set()); setSelectionAgentSelector(false); }
                  return !v;
                });
                if (isSectionMode) { setIsSectionMode(false); sectionDrawState.current = null; setDrawingPreview(null); }
              }}
              title="드래그 선택"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-md border transition-all ${
                isSelectMode
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-100 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 4l4 1-1 4M4 4l6 6" />
                <rect x="10" y="10" width="10" height="10" rx="2" strokeDasharray="3 2" />
              </svg>
              선택
            </button>

            {/* 이미지 추가 버튼 */}
            <button
              onClick={() => canvasImageInputRef.current?.click()}
              title="캔버스에 이미지 추가"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-md border bg-white text-gray-600 border-gray-100 hover:border-green-300 hover:text-green-600 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              이미지
            </button>
            <input ref={canvasImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCanvasImageUpload} />

            {/* 유저·카드 수 */}
            <div className="text-xs text-gray-400 bg-white bg-opacity-90 rounded-xl px-2.5 py-1.5 shadow-sm border border-gray-100">
              {userName} · {ideas.length}개
            </div>
          </div>

          {/* ── 선택 시 배치 액션 툴바 ── */}
          {selectedIds.size > 0 && (
            <div data-toolbar className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white rounded-2xl shadow-xl border border-gray-100 px-3 py-2">
              <span className="text-xs font-semibold text-gray-600">{selectedIds.size}개 선택됨</span>
              <div className="w-px h-4 bg-gray-200" />

              {/* 분석 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setSelectionAgentSelector(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  분석
                </button>

                {selectionAgentSelector && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 w-52">
                    <div className="text-xs font-semibold text-gray-400 px-2 py-1 mb-1">분석 방식 선택</div>
                    {AGENT_OPTIONS.map(agent => (
                      <button
                        key={agent.type}
                        onClick={() => {
                          const selectedIdeas = ideas.filter(idea => selectedIds.has(idea.id));
                          onSectionAnalysis?.(selectedIdeas, agent.type);
                          setSelectionAgentSelector(false);
                          setIsSelectMode(false);
                          setSelectedIds(new Set());
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <div className="text-xs font-semibold text-gray-800">{agent.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{agent.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 삭제 버튼 */}
              <button
                onClick={() => {
                  if (window.confirm(`${selectedIds.size}개 아이디어를 삭제할까요?`)) {
                    selectedIds.forEach(id => onDeleteIdea(id));
                    setSelectedIds(new Set());
                    setIsSelectMode(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold transition-all border border-red-100"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
                삭제
              </button>

              {/* 선택 해제 */}
              <button
                onClick={() => { setSelectedIds(new Set()); setSelectionAgentSelector(false); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* ── 우하단: 아이디어 추가 버튼 ── */}
          <div data-toolbar className="absolute bottom-4 right-4 z-20">
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              아이디어 추가
            </button>
          </div>
        </div>

      {showModal && (
        <AddIdeaModal
          onClose={() => setShowModal(false)}
          onAdd={onAddIdea}
          defaultCategory="brainstorm"
        />
      )}
    </div>
  );
};

export default Board;
