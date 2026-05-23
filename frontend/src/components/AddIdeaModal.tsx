import React, { useState, useRef, useEffect } from "react";
import { CARD_COLORS, IDEA_CATEGORIES, IdeaCategory, IdeaAttachment } from "../types";

interface AddIdeaModalProps {
  onClose: () => void;
  onAdd: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[]) => void;
  defaultCategory?: IdeaCategory;
}

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ onClose, onAdd, defaultCategory }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(CARD_COLORS[0]);
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory>(defaultCategory ?? "brainstorm");
  const [attachments, setAttachments] = useState<IdeaAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), content.trim(), selectedColor, selectedCategory, attachments);
    onClose();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const processFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    arr.forEach((file) => {
      if (attachments.length >= 5) { alert("파일은 최대 5개까지 첨부할 수 있어요"); return; }
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name}: 10MB 이하 파일만 가능해요`); return; }

      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();

      if (isImage) {
        reader.onload = () => setAttachments((prev) => prev.length >= 5 ? prev : [...prev, {
          name: file.name, type: "image", mimeType: file.type, content: reader.result as string,
        }]);
        reader.readAsDataURL(file);
      } else {
        // 비이미지: 아이콘만 표시 (내용은 base64로 저장)
        reader.onload = () => setAttachments((prev) => prev.length >= 5 ? prev : [...prev, {
          name: file.name, type: "file", mimeType: file.type, content: reader.result as string,
        }]);
        reader.readAsDataURL(file);
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const currentCategory = IDEA_CATEGORIES.find((c) => c.id === selectedCategory)!;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={handleBackdrop}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800">새 아이디어 추가</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* 카테고리 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">카테고리</label>
            <div className="grid grid-cols-2 gap-2">
              {IDEA_CATEGORIES.map((cat) => (
                <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                  style={{
                    backgroundColor: selectedCategory === cat.id ? cat.bg : "transparent",
                    borderColor: selectedCategory === cat.id ? cat.border : "#e5e7eb",
                    color: selectedCategory === cat.id ? cat.text : "#6b7280",
                  }}>
                  <span className="text-sm font-semibold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">카드 색상</label>
            <div className="flex gap-2">
              {CARD_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setSelectedColor(color)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? "#3b82f6" : "transparent",
                    boxShadow: selectedColor === color ? "0 0 0 2px #3b82f6" : "0 1px 3px rgba(0,0,0,0.15)",
                  }} />
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">아이디어 제목 *</label>
            <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="한 줄로 핵심을 표현해보세요" maxLength={60}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">아이디어 내용</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="구체적인 내용, 배경, 기대 효과 등을 자유롭게 적어주세요"
              rows={3} maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                         transition-all resize-none" />
            <p className="text-xs text-gray-400 text-right mt-1">{content.length}/500</p>
          </div>

          {/* ── 파일 첨부 ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              파일 첨부 <span className="text-gray-400 font-normal normal-case">(선택사항 · 최대 5개)</span>
            </label>

            {/* 드래그앤드롭 영역 */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-600">클릭하거나 파일을 드래그해서 올려요</p>
                <p className="text-xs text-gray-400 mt-0.5">이미지, PDF, 문서 등 · 파일당 10MB 이하</p>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                className="hidden" onChange={handleFileChange} />
            </div>

            {/* 첨부된 파일 목록 */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg group">
                    {att.type === "image" ? (
                      <img src={att.content} alt={att.name}
                        className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200" />
                    ) : (
                      <span className="text-gray-400 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
                    )}
                    <span className="text-xs text-gray-700 flex-1 truncate">{att.name}</span>
                    <button type="button" onClick={() => removeAttachment(idx)}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 미리보기 */}
          {title && (
            <div className="rounded-lg p-3 border border-gray-100" style={{ backgroundColor: selectedColor }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: currentCategory.bg, color: currentCategory.text }}>
                  {currentCategory.label}
                </span>
                {attachments.length > 0 && (
                  <span className="text-xs text-gray-500">{attachments.length}개 파일 첨부됨</span>
                )}
              </div>
              <p className="font-bold text-gray-800 text-sm">{title}</p>
              {content && <p className="text-gray-700 text-xs mt-1 line-clamp-2">{content}</p>}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium">
              취소
            </button>
            <button type="submit" disabled={!title.trim()}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400
                         text-white rounded-lg text-sm font-semibold transition-colors">
              추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIdeaModal;
