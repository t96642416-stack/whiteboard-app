import React, { useState } from "react";
import { BoardSection, Idea } from "../types";

interface BoardSectionFrameProps {
  section: BoardSection;
  ideas: Idea[];
  onDelete: (id: string) => void;
  onAddIdea: () => void;
  onAnalyze: (sectionId: string) => void;
  onDragStart: (e: React.PointerEvent, sectionId: string) => void;
}

const SECTION_WIDTH = 320;

const BoardSectionFrame: React.FC<BoardSectionFrameProps> = ({
  section,
  ideas,
  onDelete,
  onAddIdea,
  onAnalyze,
  onDragStart,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-card-wrapper="true"
      className="absolute"
      style={{ left: section.x, top: section.y, width: SECTION_WIDTH }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: SECTION_WIDTH,
          backgroundColor: "white",
          borderLeft: `4px solid ${section.color}`,
          borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Drag handle / header */}
        <div
          style={{
            backgroundColor: section.color,
            padding: "10px 12px 8px 12px",
            cursor: "grab",
            userSelect: "none",
          }}
          onPointerDown={(e) => onDragStart(e, section.id)}
        >
          {/* drag dots */}
          <div className="flex items-center gap-0.5 mb-1.5 opacity-40">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-0.5 h-1.5 rounded-full bg-gray-600" />
            ))}
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{section.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{section.description}</p>
            </div>
            {/* delete button */}
            {hovered && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
                className="flex-shrink-0 w-5 h-5 rounded-full bg-white bg-opacity-70 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                title="섹션 삭제"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <span
            className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-gray-600"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          >
            {ideas.length}개 아이디어
          </span>
        </div>

        {/* Mini idea cards */}
        <div className="p-2 space-y-1.5">
          {ideas.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">아이디어가 없어요</p>
          ) : (
            ideas.map((idea) => (
              <div
                key={idea.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: idea.color || "#e5e7eb" }}
                />
                <span className="text-xs text-gray-700 flex-1 truncate font-medium">{idea.title}</span>
                <span
                  className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#e5e7eb", color: "#4b5563" }}
                >
                  {idea.author.charAt(0).toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Bottom buttons */}
        <div className="flex gap-1.5 px-2 pb-2">
          <button
            onClick={onAddIdea}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            아이디어 추가
          </button>
          <button
            onClick={() => onAnalyze(section.id)}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-600 hover:bg-purple-100 hover:border-purple-400 transition-all font-medium"
          >
            🤖 분석
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardSectionFrame;
