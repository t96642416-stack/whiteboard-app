import React, { useState, useRef, useEffect } from "react";
import { Idea, IdeaCategory, IdeaAttachment, CARD_COLORS } from "../types";

interface IdeaCardProps {
  idea: Idea;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string, content: string, category: IdeaCategory, color: string, attachments?: IdeaAttachment[]) => void;
  onAddComment: (ideaId: string, text: string) => void;
}

const FileIcon: React.FC<{ mimeType?: string; size?: number }> = ({ mimeType, size = 14 }) => {
  if (mimeType?.startsWith("image/")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (mimeType?.includes("pdf")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" /><line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onDelete, onEdit, onAddComment }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editContent, setEditContent] = useState(idea.content);
  const editCategory: IdeaCategory = idea.category ?? "brainstorm";
  const [editColor, setEditColor] = useState(idea.color);
  const [editAttachments, setEditAttachments] = useState<IdeaAttachment[]>(idea.attachments ?? []);
  const [linkInput, setLinkInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(idea.title);
      setEditContent(idea.content);

      setEditColor(idea.color);
      setEditAttachments(idea.attachments ?? []);
    }
  }, [idea.title, idea.content, idea.color, idea.attachments, isEditing]);

  const handleStartEdit = () => {
    setEditTitle(idea.title);
    setEditContent(idea.content);
    setEditColor(idea.color);
    setEditAttachments(idea.attachments ?? []);
    setIsEditing(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const handleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;
    onEdit(idea.id, trimmedTitle, editContent.trim(), editCategory, editColor, editAttachments);
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

  // 편집 모드 첨부파일 추가
  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (editAttachments.length >= 5) { alert("파일은 최대 5개까지 첨부할 수 있어요"); return; }
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name}: 10MB 이하만 가능해요`); return; }
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();
      reader.onload = () => {
        setEditAttachments(prev => prev.length >= 5 ? prev : [...prev, {
          name: file.name,
          type: isImage ? "image" : "file",
          mimeType: file.type,
          content: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const comments = idea.comments ?? [];
  const attachments: IdeaAttachment[] = idea.attachments ?? [];

  return (
    <div
      className="relative rounded-lg p-4 shadow-md min-h-[140px] flex flex-col group"
      style={{
        backgroundColor: isEditing ? editColor : idea.color,
        border: isEditing ? "2px solid #4F48ED" : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isEditing
          ? "0 0 0 3px rgba(59,130,246,0.15), 2px 3px 8px rgba(0,0,0,0.12)"
          : "2px 3px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        transition: "border 0.15s, box-shadow 0.15s",
      }}
    >
      {isEditing ? (
        /* ── 편집 모드 ── */
        <>
          {/* 색상 선택 */}
          <div className="flex items-center gap-1.5 mb-2">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-all flex-shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: editColor === c ? "#4F48ED" : "rgba(0,0,0,0.15)",
                  transform: editColor === c ? "scale(1.25)" : "scale(1)",
                }}
              />
            ))}
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

          {/* 첨부파일 편집 */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-medium">첨부파일</span>
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                disabled={editAttachments.length >= 5}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-300 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                파일
              </button>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                multiple
                className="hidden"
                onChange={handleEditFileUpload}
              />
            </div>

            {/* 링크 입력 */}
            <div className="flex gap-1 mb-1.5">
              <input
                type="text"
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = linkInput.trim();
                    if (!url) return;
                    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
                    setEditAttachments(prev => prev.length >= 5 ? prev : [...prev, { name: withProtocol, type: "link", content: withProtocol }]);
                    setLinkInput("");
                  }
                }}
                placeholder="링크 URL (Enter)"
                className="flex-1 px-2 py-1 bg-white bg-opacity-60 rounded-md text-xs text-gray-700 border border-blue-200 focus:outline-none focus:border-blue-400 min-w-0"
              />
              <button
                type="button"
                onClick={() => {
                  const url = linkInput.trim();
                  if (!url) return;
                  const withProtocol = url.startsWith("http") ? url : `https://${url}`;
                  setEditAttachments(prev => prev.length >= 5 ? prev : [...prev, { name: withProtocol, type: "link", content: withProtocol }]);
                  setLinkInput("");
                }}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-xs font-semibold flex-shrink-0 transition-colors"
              >추가</button>
            </div>

            {editAttachments.length > 0 ? (
              <div className="space-y-1">
                {editAttachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white bg-opacity-60 rounded-lg border border-blue-100 group/att">
                    {att.type === "image" ? (
                      <img src={att.content} alt={att.name} className="w-5 h-5 rounded object-cover flex-shrink-0 border border-gray-200" />
                    ) : att.type === "link" ? (
                      <span className="text-indigo-400 flex-shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      </span>
                    ) : (
                      <span className="text-gray-400 flex-shrink-0"><FileIcon mimeType={att.mimeType} size={12} /></span>
                    )}
                    <span className="text-xs text-gray-600 flex-1 truncate">{att.type === "link" ? att.content : att.name}</span>
                    <button
                      type="button"
                      onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-blue-200 rounded-lg text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                파일 첨부
              </button>
            )}
          </div>

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

          {/* AI 예상 이미지 */}
          {idea.aiImageUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-black border-opacity-10 shadow-sm relative group/aiimg" style={{ height: 140 }}>
              <img
                src={idea.aiImageUrl}
                alt={`${idea.title} 예상`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black from-0% to-transparent to-100% px-2 py-1.5">
                <span className="text-white text-xs font-medium opacity-80">AI 적용 예상 모습</span>
              </div>
            </div>
          )}

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
              {/* 링크는 외부 링크로 */}
              {attachments.filter((a) => a.type === "link").map((att, i) => (
                <a
                  key={i}
                  href={att.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white bg-opacity-60 border border-black border-opacity-10 hover:bg-opacity-80 transition-all max-w-full"
                >
                  <span className="text-indigo-400 flex-shrink-0">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  </span>
                  <span className="text-xs text-indigo-600 truncate">{att.content}</span>
                </a>
              ))}
              {/* 비이미지 파일은 칩으로 */}
              {attachments.filter((a) => a.type === "file").map((att, i) => (
                <a
                  key={i}
                  href={att.content}
                  download={att.name}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white bg-opacity-60 border border-black border-opacity-10 hover:bg-opacity-80 transition-all max-w-full"
                >
                  <span className="text-gray-500 flex-shrink-0"><FileIcon mimeType={att.mimeType} size={12} /></span>
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
              className="mt-2 rounded-xl overflow-hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* 기존 코멘트 목록 */}
              {comments.length > 0 && (
                <div className="px-2 pt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 text-xs font-bold leading-none">{c.author.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-800">{c.author}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(c.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed pl-5" style={{ whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* 코멘트 입력 */}
              <form onSubmit={handleSubmitComment} className="flex items-center gap-1 p-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="코멘트 추가..."
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white shadow-sm"
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
