import React, { useEffect, useRef } from "react";
import { AgentType, AGENT_OPTIONS } from "../types";

interface AgentSelectorProps {
  selectedAgent: AgentType;
  onSelect: (agent: AgentType) => void;
  onClose: () => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgent,
  onSelect,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
      style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08)" }}
    >
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div>
          <p className="text-sm font-bold text-gray-800">AI 에이전트 선택</p>
          <p className="text-xs text-gray-500 mt-0.5">분석 방식을 선택하세요</p>
        </div>
        {selectedAgent && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            초기화
          </button>
        )}
      </div>

      {/* 에이전트 목록 */}
      <div className="py-1">
        {AGENT_OPTIONS.map((agent) => {
          const isSelected = selectedAgent === agent.type;
          return (
            <button
              key={agent.type}
              onClick={() => {
                onSelect(isSelected ? null : agent.type);
                onClose();
              }}
              className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-blue-50 transition-colors text-left
                          ${isSelected ? "bg-blue-50" : ""}`}
            >
              <span className="text-lg leading-none mt-0.5">{agent.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                    {agent.name}
                  </p>
                  {isSelected && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                      선택됨
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AgentSelector;
