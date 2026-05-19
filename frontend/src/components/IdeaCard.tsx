import React from "react";
import { Idea } from "../types";

interface IdeaCardProps {
  idea: Idea;
  onDelete: (id: string) => void;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onDelete }) => {
  return (
    <div
      className="relative rounded-lg p-4 shadow-md min-h-[140px] flex flex-col group"
      style={{
        backgroundColor: idea.color,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      {/* 삭제 버튼 */}
      <button
        onClick={() => onDelete(idea.id)}
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center
                   bg-white bg-opacity-0 hover:bg-opacity-70 text-gray-400 hover:text-gray-700
                   opacity-0 group-hover:opacity-100 transition-all duration-150"
        aria-label="아이디어 삭제"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="1" y1="1" x2="11" y2="11" />
          <line x1="11" y1="1" x2="1" y2="11" />
        </svg>
      </button>

      {/* 제목 */}
      <h3
        className="font-bold text-gray-800 text-sm leading-snug pr-6 mb-2"
        style={{ wordBreak: "keep-all" }}
      >
        {idea.title}
      </h3>

      {/* 내용 */}
      <p
        className="text-gray-700 text-xs leading-relaxed flex-1"
        style={{ wordBreak: "keep-all", whiteSpace: "pre-wrap" }}
      >
        {idea.content}
      </p>

      {/* 작성자 */}
      <div className="mt-3 flex items-center gap-1">
        <div className="w-5 h-5 rounded-full bg-gray-400 bg-opacity-40 flex items-center justify-center">
          <span className="text-gray-600 text-xs font-semibold">
            {idea.author.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{idea.author}</span>
        <span className="text-gray-300 text-xs ml-auto">
          {new Date(idea.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};

export default IdeaCard;
