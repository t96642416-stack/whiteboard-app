import React, { useState, useRef, useEffect } from "react";
import { CARD_COLORS } from "../types";

interface AddIdeaModalProps {
  onClose: () => void;
  onAdd: (title: string, content: string, color: string) => void;
}

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ onClose, onAdd }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(CARD_COLORS[0]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), content.trim(), selectedColor);
    onClose();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">새 아이디어 추가</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 색상 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              카드 색상
            </label>
            <div className="flex gap-2">
              {CARD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? "#3b82f6" : "transparent",
                    boxShadow: selectedColor === color ? "0 0 0 2px #3b82f6" : "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              아이디어 제목 *
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="한 줄로 핵심을 표현해보세요"
              maxLength={60}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              아이디어 내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="구체적인 내용, 배경, 기대 효과 등을 자유롭게 적어주세요"
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                         transition-all resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{content.length}/500</p>
          </div>

          {/* 미리보기 */}
          {title && (
            <div
              className="rounded-lg p-3 border border-gray-100"
              style={{ backgroundColor: selectedColor }}
            >
              <p className="text-xs text-gray-500 mb-1 font-medium">미리보기</p>
              <p className="font-bold text-gray-800 text-sm">{title}</p>
              {content && <p className="text-gray-700 text-xs mt-1 line-clamp-2">{content}</p>}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600
                         hover:bg-gray-50 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400
                         text-white rounded-lg text-sm font-semibold transition-colors"
            >
              추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIdeaModal;
