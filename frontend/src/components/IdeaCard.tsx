import React, { useState, useRef, useEffect } from "react";
import { Idea, IDEA_CATEGORIES, IdeaCategory, IdeaAttachment } from "../types";

interface IdeaCardProps {
  idea: Idea;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string, content: string, category: IdeaCategory) => void;
  onAddComment: (ideaId: string, text: string) => void;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onDelete, onEdit, onAddComment }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editContent, setEditContent] = useState(idea.content);
  const [editCategory, setEditCategory] = useState<IdeaCategory>(idea.category ?? "brainstorm");
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(idea.title);
      setEditContent(idea.content);
      setEditCategory(idea.category ?? "brainstorm");
    }
  }, [idea.title, idea.content, idea.category, isEditing]);

  const handleStartEdit = () => {
    setEditTitle(idea.title);
    setEditContent(idea.content);
    setEditCategory(idea.category ?? "brainstorm");
    setIsEditing(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const handleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;
    onEdit(idea.id, trimmedTitle, editContent.trim(), editCategory);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
  };

  const handleToggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(v => {
      if (!v) setTimeout(() => commentInputRef.current?.focus(), 50);
      return !v;
    });
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    onAddComment(idea.id, text);
    setCommentText("");
  };

  const comments = idea.comments ?? [];
  const cat = IDEA_CATEGORIES.find((c) => c.id === (idea.category ?? "brainstorm")) ?? IDEA_CATEGORIES[0];
  const attachments: IdeaAttachment[] = idea.attachments ?? [];

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return "📄";
    if (mimeType.includes("pdf")) return "📕";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📋";
    return "📎";
  };

  return (
    <div
      className="relative rounded-lg p-4 shadow-md min-h-[140px] flex flex-col group"
      style={{
        backgroundColor: idea.color,
        border: isEditing ? "2px solid #3b82f6" : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isEditing
          ? "0 0 0 3px rgba(59,130,246,0.15), 2px 3px 8px rgba(0,0,0,0.12)"
          : "2px 3px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        transition: "border 0.15s, box-shadow 0.15s",
      }}
    >
      {isEditing ? (
        /* ── 편집 모드 ── */
        <>
          {/* 카테고리 선택 */}
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              {IDEA_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEditCategory(c.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: editCategory === c.id ? c.bg : "transparent",
                    borderColor: editCategory === c.id ? c.border : "#d1d5db",
                    color: editCategory === c.id ? c.text : "#9ca3af",
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 입력 */}
          <input
            ref={titleRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="제목"
            className="w-full bg-white bg-opacity-60 rounded-md px-2 py-1 text-sm font-bold text-gray-800
                       border border-blue-200 focus:outline-none focus:border-blue-400 mb-2"
          />

          {/* 내용 입력 */}
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="내용 (선택사항)"
            rows={3}
            className="w-full flex-1 bg-white bg-opacity-60 rounded-md px-2 py-1 text-xs text-gray-700
                       border border-blue-200 focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
          />

          {/* 저장 / 취소 */}
          <div className="flex items-center justify-end gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-auto">Ctrl+Enter로 저장</span>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:bg-black hover:bg-opacity-10 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!editTitle.trim()}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white transition-all shadow-sm"
            >
              저장
            </button>
          </div>
        </>
      ) : (
        /* ── 보기 모드 ── */
        <>
          {/* 삭제 버튼 */}
          <button
            onClick={() => onDelete(idea.id)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center
                       bg-white bg-opacity-0 hover:bg-opacity-70 text-gray-400 hover:text-gray-700
                       opacity-0 group-hover:opacity-100 transition-all duration-150"
            aria-label="아이디어 삭제"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>

          {/* 수정 버튼 */}
          <button
            onClick={handleStartEdit}
            className="absolute top-2 right-8 w-6 h-6 rounded-full flex items-center justify-center
                       bg-white bg-opacity-0 hover:bg-opacity-70 text-gray-400 hover:text-blue-500
                       opacity-0 group-hover:opacity-100 transition-all duration-150"
            aria-label="아이디어 수정"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {/* 카테고리 뱃지 */}
          <div className="mb-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: cat.bg, color: cat.text }}
              onClick={handleStartEdit}
              title="클릭해서 카테고리 변경"
            >
              {cat.emoji} {cat.label}
            </span>
          </div>

          {/* 제목 */}
          <h3
            className="font-bold text-gray-800 text-sm leading-snug pr-12 mb-2 cursor-text hover:text-blue-700 transition-colors"
            style={{ wordBreak: "keep-all" }}
            onClick={handleStartEdit}
          >
            {idea.title}
          </h3>

          {/* 내용 */}
          <p
            className="text-gray-700 text-xs leading-relaxed flex-1 cursor-text"
            style={{ wordBreak: "keep-all", whiteSpace: "pre-wrap" }}
            onClick={handleStartEdit}
          >
            {idea.content}
          </p>

          {/* 첨부 파일 */}
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {/* 이미지는 썸네일로 */}
              {attachments.filter((a) => a.type === "image").length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {attachments.filter((a) => a.type === "image").map((att, i) => (
                    <img
                      key={i}
                      src={att.content}
                      alt={att.name}
                      title={att.name}
                      className="w-12 h-12 rounded-lg object-cover border border-black border-opacity-10 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                      onClick={(e) => { e.stopPropagation(); window.open(att.content, "_blank"); }}
                    />
                  ))}
                </div>
              )}
              {/* 비이미지 파일은 칩으로 */}
              {attachments.filter((a) => a.type === "file").map((att, i) => (
                <a
                  key={i}
                  href={att.content}
                  download={att.name}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white bg-opacity-60 border border-black border-opacity-10 hover:bg-opacity-80 transition-all max-w-full"
                >
                  <span className="text-sm flex-shrink-0">{getFileIcon(att.mimeType)}</span>
                  <span className="text-xs text-gray-600 truncate">{att.name}</span>
                </a>
              ))}
            </div>
          )}

          {/* 작성자 + 코멘트 버튼 */}
          <div className="mt-3 flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-gray-400 bg-opacity-40 flex items-center justify-center">
              <span className="text-gray-600 text-xs font-semibold">
                {idea.author.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-gray-500 text-xs">{idea.author}</span>
            <span className="text-gray-300 text-xs ml-auto">
              {new Date(idea.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {/* 코멘트 토글 버튼 */}
            <button
              onClick={handleToggleComments}
              className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full text-xs transition-all hover:bg-black hover:bg-opacity-10"
              style={{ color: showComments ? "#6366f1" : "#9ca3af" }}
              title="코멘트"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              {comments.length > 0 && <span className="font-semibold">{comments.length}</span>}
            </button>
          </div>

          {/* 코멘트 영역 */}
          {showComments && (
            <div
              className="mt-2 border-t pt-2"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* 기존 코멘트 목록 */}
              {comments.length > 0 && (
                <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="bg-white bg-opacity-60 rounded-lg px-2 py-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(c.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* 코멘트 입력 */}
              <form onSubmit={handleSubmitComment} className="flex items-center gap-1">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="코멘트 추가..."
                  className="flex-1 text-xs px-2 py-1 rounded-lg border focus:outline-none focus:border-indigo-400"
                  style={{ backgroundColor: "rgba(255,255,255,0.7)", borderColor: "rgba(0,0,0,0.12)" }}
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="p-1 rounded-lg disabled:opacity-30 transition-opacity"
                  style={{ color: "#6366f1" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IdeaCard;
