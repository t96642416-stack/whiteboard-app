import React, { useState, useRef, useEffect, useCallback } from "react";
import { AgentType, AnalysisResult as AnalysisResultType, AgentAnalysisResult, ChatMessage } from "../types";
import AgentSelector from "./AgentSelector";
import AnalysisResult from "./AnalysisResult";
import AgentAnalysisResultComponent from "./AgentAnalysisResult";
import { useMeetingRecognition } from "../hooks/useVoiceRecognition";

interface AIPanelProps {
  analysisResult: AnalysisResultType | null;
  agentAnalysisResult: AgentAnalysisResult | null;
  isAnalyzing: boolean;
  chatMessages: ChatMessage[];
  selectedAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
  onSendChat: (message: string, imageUrl?: string) => void;
  onRequestAnalysis: (agentType: AgentType) => void;
  isAIResponding: boolean;
}

const AIPanel: React.FC<AIPanelProps> = ({
  analysisResult,
  agentAnalysisResult,
  isAnalyzing,
  chatMessages,
  selectedAgent,
  onAgentChange,
  onSendChat,
  onRequestAnalysis,
  isAIResponding,
}) => {
  const [inputText, setInputText] = useState("");
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "chat" | "meeting">("analysis");
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(400);

  const { isRecording, interimText, startRecording, stopRecording, clearTranscript, isSupported } =
    useMeetingRecognition({
      onTranscriptUpdate: (lines) => setTranscriptLines(lines),
      onError: (err) => {
        setVoiceError(err);
        setTimeout(() => setVoiceError(null), 5000);
      },
    });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, interimText]);

  // 리사이즈 핸들러
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    e.preventDefault();
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(720, Math.max(320, startWidth.current + delta));
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSendChat = () => {
    const msg = inputText.trim();
    if (!msg) return;
    onSendChat(msg);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("2MB 이하 이미지만 업로드 가능해요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = reader.result as string;
      onSendChat("", imageUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // 에이전트 선택 핸들러
  const handleAgentSelect = (agent: AgentType) => {
    onAgentChange(agent);
    if (agent !== null) {
      onRequestAnalysis(agent);
      setActiveTab("analysis");
      setShowAgentSelector(false);
    } else {
      setShowAgentSelector(false);
    }
  };

  // 회의 내용 AI 분석
  const handleMeetingAnalyze = () => {
    if (transcriptLines.length === 0) return;
    const meetingText = transcriptLines.join("\n");
    const message = `다음은 팀 회의에서 나온 대화 내용입니다. 보드의 아이디어들과 연결해서 종합적으로 분석해주세요.\n\n[회의 내용]\n${meetingText}\n\n위 회의 내용을 바탕으로: 1) 어떤 아이디어가 더 지지받았는지, 2) 회의에서 나온 새로운 인사이트, 3) 다음 액션 플랜을 정리해주세요.`;
    onSendChat(message);
    setActiveTab("chat");
  };

  const hasResult = !!(analysisResult || agentAnalysisResult);

  return (
    <div
      className="flex flex-col bg-white border-l border-gray-200 h-full relative"
      style={{ width: panelWidth, minWidth: panelWidth, flexShrink: 0 }}
    >
      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group"
        style={{ width: "4px" }}
      >
        <div
          className="w-full h-full transition-colors"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "#3b82f6"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
        />
      </div>

      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            AI 분석 패널
          </h2>
          {isAnalyzing ? (
            <span className="text-xs text-orange-500 font-medium flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              분석 중...
            </span>
          ) : hasResult ? (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              분석 완료
            </span>
          ) : (
            <span className="text-xs text-gray-400">대기 중</span>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "analysis" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            분석 결과
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all relative ${
              activeTab === "chat" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            채팅
            {chatMessages.length > 0 && activeTab !== "chat" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center">
                {chatMessages.length > 9 ? "9+" : chatMessages.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("meeting")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all relative ${
              activeTab === "meeting" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🎤 회의
            {isRecording && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">

        {/* 분석 결과 탭 */}
        {activeTab === "analysis" && (
          <div className="p-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4" />
                <p className="text-gray-600 font-medium text-sm">AI가 분석 중입니다...</p>
                <p className="text-gray-400 text-xs mt-1">잠시만 기다려주세요</p>
              </div>
            ) : agentAnalysisResult ? (
              <AgentAnalysisResultComponent result={agentAnalysisResult} />
            ) : analysisResult ? (
              <AnalysisResult result={analysisResult} />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <p className="text-gray-700 font-semibold text-sm mb-1">에이전트를 선택해서 분석하기</p>
                <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                  에이전트를 선택하면<br />
                  아이디어를 다양한 관점으로 분석해요
                </p>
                <button
                  onClick={() => setShowAgentSelector(true)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  에이전트 선택하기
                </button>
                {showAgentSelector && (
                  <div className="fixed inset-0 z-50" onClick={() => setShowAgentSelector(false)}>
                    <div className="absolute bottom-20 right-4" onClick={(e) => e.stopPropagation()}>
                      <AgentSelector
                        selectedAgent={selectedAgent}
                        onSelect={handleAgentSelect}
                        onClose={() => setShowAgentSelector(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 채팅 탭 (순수 채팅방) */}
        {activeTab === "chat" && (
          <div className="p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium text-sm mb-1">팀원들과 채팅해보세요</p>
                <p className="text-gray-400 text-xs">이미지도 올릴 수 있어요 📸</p>
              </div>
            ) : (
              <>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    <span
                      className="text-xs font-semibold px-1"
                      style={{ color: msg.userColor || "#6b7280" }}
                    >
                      {msg.userName}
                    </span>
                    {msg.imageUrl ? (
                      <img
                        src={msg.imageUrl}
                        alt="shared"
                        className="w-full rounded-xl border border-gray-100 shadow-sm cursor-pointer object-contain"
                        onClick={() => window.open(msg.imageUrl, "_blank")}
                      />
                    ) : (
                      <div
                        className="inline-block max-w-[280px] rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed"
                        style={{
                          backgroundColor: msg.userColor || "#E5E7EB",
                          color: msg.userColor === "#4F48ED" ? "#ffffff" : "#1f2937",
                        }}
                      >
                        {msg.message}
                      </div>
                    )}
                    <span className="text-xs text-gray-300 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            )}
          </div>
        )}

        {/* 🎤 회의 탭 */}
        {activeTab === "meeting" && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-100">
              {!isSupported ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  ⚠️ Chrome 브라우저에서만 음성 인식이 가능해요
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        isRecording
                          ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200"
                          : "bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                      }`}
                    >
                      {isRecording ? (
                        <><span className="w-3 h-3 rounded-sm bg-white" />회의 중지</>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" fill="none" strokeWidth="2" />
                            <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" />
                            <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" />
                          </svg>
                          회의 시작
                        </>
                      )}
                    </button>
                    {transcriptLines.length > 0 && !isRecording && (
                      <button onClick={clearTranscript} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">
                        초기화
                      </button>
                    )}
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-red-600 font-medium">회의 내용을 인식 중이에요...</span>
                    </div>
                  )}
                  {voiceError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">{voiceError}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {transcriptLines.length === 0 && !interimText ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium text-sm mb-1">회의를 시작해보세요</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    '회의 시작' 버튼을 누르면<br />대화 내용이 실시간으로 기록돼요
                  </p>
                </div>
              ) : (
                <>
                  {transcriptLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-gray-300 text-xs mt-0.5 flex-shrink-0 font-mono">{String(idx + 1).padStart(2, "0")}</span>
                      <p className="text-sm text-gray-700 leading-relaxed">{line}</p>
                    </div>
                  ))}
                  {interimText && (
                    <div className="flex gap-2 items-start opacity-50">
                      <span className="text-gray-300 text-xs mt-0.5 flex-shrink-0 font-mono">··</span>
                      <p className="text-sm text-gray-500 italic leading-relaxed">{interimText}</p>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>

            {transcriptLines.length > 0 && (
              <div className="p-4 border-t border-gray-100 bg-gradient-to-t from-gray-50">
                <div className="text-xs text-gray-400 mb-2 text-center">{transcriptLines.length}개 문장 인식됨</div>
                <button
                  onClick={handleMeetingAnalyze}
                  disabled={isAIResponding}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600
                             disabled:from-gray-300 disabled:to-gray-300 text-white font-semibold text-sm rounded-xl shadow-md transition-all
                             flex items-center justify-center gap-2"
                >
                  ✨ 회의 내용 AI 분석하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 입력창 - 채팅 탭만 표시 */}
      {activeTab === "chat" && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2">
            {/* 이미지 업로드 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-all"
              title="이미지 업로드"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            {/* 텍스트 입력 */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-full
                         focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                         transition-all text-gray-800 placeholder-gray-400"
            />

            {/* 전송 버튼 */}
            <button
              onClick={handleSendChat}
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200
                         flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={!inputText.trim() ? "#9ca3af" : "white"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 분석 결과 탭 하단 - 에이전트 선택 버튼 */}
      {activeTab === "analysis" && !isAnalyzing && (
        <div className="border-t border-gray-100 p-3 relative">
          <button
            onClick={() => setShowAgentSelector(!showAgentSelector)}
            className="w-full py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600
                       hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
            </svg>
            에이전트 선택해서 분석하기
          </button>
          {showAgentSelector && (
            <AgentSelector
              selectedAgent={selectedAgent}
              onSelect={handleAgentSelect}
              onClose={() => setShowAgentSelector(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AIPanel;
