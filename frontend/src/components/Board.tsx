import React, { useState } from "react";
import { Idea, IdeaCategory, IDEA_CATEGORIES, IdeaAttachment, CARD_COLORS } from "../types";
import IdeaCard from "./IdeaCard";
import AddIdeaModal from "./AddIdeaModal";

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
  selectedCategory,
  onCategoryChange,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [localTopic, setLocalTopic] = useState(topic);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/agent-idea")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    // 자식 요소로 이동할 때는 무시
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
      const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
      onAddIdea(title, content, color, "brainstorm", []);
    } catch {
      // ignore
    }
  };

  const handleTopicBlur = () => {
    setEditingTopic(false);
    onTopicChange(localTopic);
  };

  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditingTopic(false);
      onTopicChange(localTopic);
    }
  };

  React.useEffect(() => {
    setLocalTopic(topic);
  }, [topic]);

  // 카테고리 필터 적용
  const filteredIdeas = selectedCategory === "all"
    ? ideas
    : ideas.filter((i) => (i.category ?? "brainstorm") === selectedCategory);

  // 카테고리별 개수
  const countByCategory = (catId: string) =>
    catId === "all" ? ideas.length : ideas.filter((i) => (i.category ?? "brainstorm") === catId).length;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#f4f3ef" }}>
      {/* ── 상단 헤더 ── */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white bg-opacity-70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">협업 화이트보드</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                방 ID: <span className="font-mono font-semibold text-gray-700">{roomId}</span>
              </span>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-500">{users.length}명 접속 중</span>
              </div>
              {users.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1">
                    {users.slice(0, 4).map((u) => (
                      <div
                        key={u.name}
                        title={u.name}
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-sm"
                        style={{ backgroundColor: u.color, color: u.color === "#E5E7EB" ? "#374151" : "white" }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {users.length > 4 && (
                      <span className="text-xs text-gray-500 ml-1">+{users.length - 4}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                       text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            아이디어 추가
          </button>
        </div>

        {/* 주제 입력 */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">📌 주제</span>
            {editingTopic ? (
              <input
                autoFocus
                type="text"
                value={localTopic}
                onChange={(e) => setLocalTopic(e.target.value)}
                onBlur={handleTopicBlur}
                onKeyDown={handleTopicKeyDown}
                placeholder="회의 주제를 입력하세요"
                className="flex-1 px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-800"
              />
            ) : (
              <button
                onClick={() => setEditingTopic(true)}
                className={`flex-1 text-left px-3 py-1.5 rounded-lg text-sm transition-all border
                  ${localTopic
                    ? "border-transparent text-gray-800 font-medium hover:border-gray-200 hover:bg-gray-50"
                    : "border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                  }`}
              >
                {localTopic || "클릭해서 주제를 입력하세요..."}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 카테고리 필터 탭 ── */}
      <div className="px-6 pt-4 pb-2 bg-white bg-opacity-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {/* 전체 탭 */}
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
            }`}>
              {countByCategory("all")}
            </span>
          </button>

          {/* 카테고리별 탭 */}
          {IDEA_CATEGORIES.map((cat) => {
            const count = countByCategory(cat.id);
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border"
                style={{
                  backgroundColor: isActive ? cat.bg : "white",
                  color: isActive ? cat.text : "#6b7280",
                  borderColor: isActive ? cat.border : "#e5e7eb",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {cat.emoji} {cat.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: isActive ? "rgba(0,0,0,0.1)" : "#f3f4f6",
                    color: isActive ? cat.text : "#9ca3af",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 보드 영역 ── */}
      <div
        className={`flex-1 overflow-y-auto p-6 relative transition-colors ${isDragOver ? "bg-indigo-50" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 드래그 오버 오버레이 */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="border-2 border-dashed border-indigo-400 rounded-2xl bg-indigo-50 bg-opacity-80 px-8 py-6 flex flex-col items-center gap-2 shadow-lg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              <p className="text-sm font-semibold text-indigo-600">여기에 놓으면 아이디어 카드로 추가돼요</p>
            </div>
          </div>
        )}
        {filteredIdeas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-yellow-100 flex items-center justify-center mb-4 shadow-sm">
              {selectedCategory === "all" ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              ) : (
                <span className="text-3xl">
                  {IDEA_CATEGORIES.find((c) => c.id === selectedCategory)?.emoji}
                </span>
              )}
            </div>
            {selectedCategory === "all" ? (
              <>
                <p className="text-gray-500 font-medium text-lg mb-1">아직 아이디어가 없어요</p>
                <p className="text-gray-400 text-sm mb-4">첫 번째 아이디어를 추가해보세요!</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium text-lg mb-1">
                  '{IDEA_CATEGORIES.find((c) => c.id === selectedCategory)?.label}' 아이디어가 없어요
                </p>
                <p className="text-gray-400 text-sm mb-4">이 카테고리로 아이디어를 추가해보세요</p>
              </>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
            >
              + 아이디어 추가
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onDelete={onDeleteIdea}
                onEdit={onEditIdea}
              />
            ))}
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400
                         min-h-[140px] flex flex-col items-center justify-center gap-2
                         text-gray-400 hover:text-blue-500 transition-all group"
            >
              <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-sm font-medium">아이디어 추가</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 하단 상태바 ── */}
      <div className="px-6 py-2 border-t border-gray-200 bg-white bg-opacity-50 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {selectedCategory === "all"
            ? `총 ${ideas.length}개의 아이디어`
            : `${IDEA_CATEGORIES.find((c) => c.id === selectedCategory)?.label} ${filteredIdeas.length}개 / 전체 ${ideas.length}개`
          } · {userName}님으로 접속 중
        </span>
        <span className="text-xs text-gray-400">
          {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {showModal && (
        <AddIdeaModal onClose={() => setShowModal(false)} onAdd={onAddIdea} />
      )}
    </div>
  );
};

export default Board;
