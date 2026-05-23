import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { AgentType, AnalysisResult as AnalysisResultType, AgentAnalysisResult, ChatMessage, AGENT_OPTIONS, AnalysisFile, IdeaCategory, IDEA_CATEGORIES, AnalysisHistoryItem, IdeaAttachment, CARD_COLORS, AnalysisSnapshot } from "../types";
import AnalysisResult from "./AnalysisResult";
import AgentAnalysisResultComponent from "./AgentAnalysisResult";
import { useMeetingRecognition } from "../hooks/useVoiceRecognition";

interface AIPanelProps {
  analysisResult: AnalysisResultType | null;
  agentAnalysisResult: AgentAnalysisResult | null;
  isAnalyzing: boolean;
  analysisHistory?: AnalysisHistoryItem[];
  chatMessages: ChatMessage[];
  aiChatMessages?: ChatMessage[];
  selectedAgent?: AgentType;
  onAgentChange: (agent: AgentType) => void;
  onSendChat: (message: string, imageUrl?: string) => void;
  onSendAIMessage?: (message: string) => void;
  onRequestAnalysis: (agentType: AgentType, files?: AnalysisFile[], useSearch?: boolean) => void;
  isAIResponding: boolean;
  onClearChat?: () => void;
  selectedCategory?: IdeaCategory | "all";
  onAddIdea?: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[], snapshot?: AnalysisSnapshot) => void;
  onApplyImage?: (ideaName: string, imageUrl: string) => void;
  onUpdateHistory?: (id: string, updated: AgentAnalysisResult) => void;
  activeTab: "analysis" | "chat" | "meeting";
  onTabChange: (tab: "analysis" | "chat" | "meeting") => void;
}

const AGENT_PILL = {
  suggestion: { bg: "#FEF3C7", text: "#92400E" },
  question:   { bg: "#EDE9FE", text: "#5B21B6" },
  emphasis:   { bg: "#FED7AA", text: "#9A3412" },
  attribute:  { bg: "#D1FAE5", text: "#065F46" },
  guide:      { bg: "#FCE7F3", text: "#9D174D" },
  advise:     { bg: "#DDD6FE", text: "#4C1D95" },
};

const AIPanel: React.FC<AIPanelProps> = ({
  analysisResult,
  agentAnalysisResult,
  isAnalyzing,
  analysisHistory = [],
  chatMessages,
  aiChatMessages = [],
  onAgentChange,
  onSendChat,
  onSendAIMessage,
  onRequestAnalysis,
  isAIResponding,
  selectedCategory = "all",
  onAddIdea,
  onApplyImage,
  onUpdateHistory,
  activeTab,
  onTabChange,
}) => {
  const [inputText, setInputText] = useState("");
  const [aiInputText, setAiInputText] = useState("");
  const [useSearch, setUseSearch] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const [showAgentList, setShowAgentList] = useState(false);
  const [showInitial, setShowInitial] = useState(false);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<AnalysisHistoryItem | null>(null);
  const [analysisFiles, setAnalysisFiles] = useState<AnalysisFile[]>([]);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);

  // 채팅 세션 관리
  const [sessionStartIndex, setSessionStartIndex] = useState(0);
  const [savedSessions, setSavedSessions] = useState<{ id: string; label: string; messages: ChatMessage[] }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingSession, setViewingSession] = useState<{ id: string; label: string; messages: ChatMessage[] } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(400);

  // 현재 세션 메시지만 추출
  const currentMessages = chatMessages.slice(sessionStartIndex);

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
  }, [currentMessages]);

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChatMessages, isAIResponding]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, interimText]);

  // 새 결과가 오면 초기 화면 숨기기
  useEffect(() => {
    if (analysisResult || agentAnalysisResult) {
      setShowInitial(false);
      setShowAgentList(false);
    }
  }, [analysisResult, agentAnalysisResult]);

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
    const handleMouseUp = () => { isResizing.current = false; };
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

  // 새 채팅 시작 (현재 내용 저장 후 초기화)
  const handleNewChat = () => {
    const current = chatMessages.slice(sessionStartIndex);
    if (current.length > 0) {
      const now = new Date();
      const label = now.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setSavedSessions((prev) => [...prev, { id: Date.now().toString(), label, messages: current }]);
    }
    setSessionStartIndex(chatMessages.length);
    setShowHistory(false);
    setViewingSession(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleSendAIChat = () => {
    const msg = aiInputText.trim();
    if (!msg || isAIResponding) return;
    onSendAIMessage?.(msg);
    setAiInputText("");
  };

  const handleAIKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendAIChat();
    }
  };

  // 채팅 이미지 업로드
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

  // 분석용 파일 업로드
  const handleAnalysisFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (analysisFiles.length >= 3) {
        alert("파일은 최대 3개까지 첨부할 수 있어요");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: 5MB 이하 파일만 업로드 가능해요`);
        return;
      }

      const isImage = file.type.startsWith("image/");

      const reader = new FileReader();
      if (isImage) {
        reader.onload = () => {
          setAnalysisFiles((prev) => {
            if (prev.length >= 3) return prev;
            return [...prev, {
              name: file.name,
              type: "image",
              mimeType: file.type,
              content: reader.result as string,
            }];
          });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          setAnalysisFiles((prev) => {
            if (prev.length >= 3) return prev;
            return [...prev, {
              name: file.name,
              type: "text",
              content: reader.result as string,
            }];
          });
        };
        reader.readAsText(file, "utf-8");
      }
    });

    e.target.value = "";
  };

  const removeAnalysisFile = (index: number) => {
    setAnalysisFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 에이전트 클릭 핸들러
  const handleAgentClick = (agentType: AgentType) => {
    if (agentType === null) return;
    onAgentChange(agentType);
    onRequestAnalysis(agentType, analysisFiles.length > 0 ? analysisFiles : undefined, useSearch);
    setShowAgentList(false);
    setShowInitial(false);
  };

  // 회의 내용 AI 분석
  const handleMeetingAnalyze = () => {
    if (transcriptLines.length === 0) return;
    const meetingText = transcriptLines.join("\n");
    const message = `다음은 팀 회의에서 나온 대화 내용입니다. 보드의 아이디어들과 연결해서 종합적으로 분석해주세요.\n\n[회의 내용]\n${meetingText}\n\n위 회의 내용을 바탕으로: 1) 어떤 아이디어가 더 지지받았는지, 2) 회의에서 나온 새로운 인사이트, 3) 다음 액션 플랜을 정리해주세요.`;
    onSendChat(message);
    onTabChange("chat");
  };

  const hasResult = !!(analysisResult || agentAnalysisResult);
  // 결과가 있고 초기화 요청 없을 때만 결과 표시
  const showResult = hasResult && !showInitial;

  // 에이전트 목록 컴포넌트 (pill 스타일)
  const AgentListItems = ({ compact = false }: { compact?: boolean }) => (
    <div className="divide-y divide-gray-100">
      {AGENT_OPTIONS.map((agent) => {
        const pill = AGENT_PILL[agent.type as keyof typeof AGENT_PILL] ?? { bg: "#F3F4F6", text: "#374151" };
        return (
          <button
            key={agent.type}
            onClick={() => handleAgentClick(agent.type)}
            className={`w-full text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${compact ? "px-3 py-2.5" : "px-5 py-3.5"}`}
          >
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: pill.bg, color: pill.text }}
            >
              {agent.name}
            </span>
            <span className="text-xs text-gray-500">{agent.description}</span>
          </button>
        );
      })}
    </div>
  );

  // 파일 첨부 섹션 (초기화면용)
  const FileAttachSection = () => (
    <div className="mt-4 pt-3 border-t border-purple-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          참고 파일 첨부 <span className="text-gray-400 font-normal">(선택사항)</span>
        </span>
        <button
          type="button"
          onClick={() => analysisFileInputRef.current?.click()}
          disabled={analysisFiles.length >= 3}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          파일 추가
        </button>
        <input
          ref={analysisFileInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.pdf,image/*"
          multiple
          className="hidden"
          onChange={handleAnalysisFileUpload}
        />
      </div>

      {analysisFiles.length === 0 ? (
        <button
          type="button"
          onClick={() => analysisFileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-purple-200 rounded-xl text-xs text-gray-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          이미지, 텍스트 파일 등 AI가 참고할 파일을 추가해요
        </button>
      ) : (
        <div className="space-y-1.5">
          {analysisFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
              <span className="text-base flex-shrink-0">
                {f.type === "image" ? "🖼️" : "📄"}
              </span>
              <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
              <button
                onClick={() => removeAnalysisFile(i)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {analysisFiles.length < 3 && (
            <button
              type="button"
              onClick={() => analysisFileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-purple-200 rounded-lg text-xs text-purple-400 hover:border-purple-400 hover:bg-purple-50 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              파일 더 추가
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="flex flex-col bg-white border-l border-gray-200 h-full relative"
      style={{ width: panelWidth, minWidth: panelWidth, flexShrink: 0 }}
    >
      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10"
        style={{ width: "4px" }}
      >
        <div
          className="w-full h-full transition-colors"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "#3b82f6"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
        />
      </div>

      {/* 분석 탭 상태 표시 (헤더 없이, 탭 콘텐츠 위에 작게 표시) */}

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 분석 결과 탭 ── */}
        {activeTab === "analysis" && (
          <div className="flex flex-col">
            {/* A↑ 버튼 + 분석 상태 표시 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                {isAnalyzing ? (
                  <span className="text-xs text-orange-500 font-medium flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    분석 중...
                  </span>
                ) : showResult ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {(AGENT_OPTIONS.find((a) => a.type === (agentAnalysisResult as any)?.agentType) ||
                        AGENT_OPTIONS.find((a) => a.type === analysisHistory[0]?.agentType))?.name || "속성 분석형"} 결과 완료
                    </span>
                    <button
                      onClick={() => { setShowAnalysisHistory(true); setViewingHistoryItem(null); }}
                      className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1 transition-colors"
                      title="분석 내역 보기"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      내역 {analysisHistory.length > 0 && <span className="bg-purple-100 text-purple-600 rounded-full px-1">{analysisHistory.length}</span>}
                    </button>
                  </div>
                ) : analysisHistory.length > 0 ? (
                  <button
                    onClick={() => { setShowAnalysisHistory(true); setViewingHistoryItem(null); }}
                    className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    분석 내역 <span className="bg-purple-100 text-purple-600 rounded-full px-1">{analysisHistory.length}</span>
                  </button>
                ) : null}
              </div>
              <button
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                A↑
              </button>
            </div>

          <div className="p-4 flex flex-col">
            {/* ── 분석 내역 목록 ── */}
            {showAnalysisHistory && !viewingHistoryItem ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setShowAnalysisHistory(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-700">분석 내역</span>
                </div>
                {analysisHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="text-3xl mb-3">📊</div>
                    <p className="text-gray-500 text-sm font-medium">저장된 분석 내역이 없어요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analysisHistory.map((item) => {
                      const agent = AGENT_OPTIONS.find((a) => a.type === item.agentType);
                      return (
                        <button key={item.id} onClick={() => setViewingHistoryItem(item)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                              {agent?.emoji} {agent?.name || "속성 분석형"}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="group-hover:stroke-purple-400"><path d="M9 18l6-6-6-6" /></svg>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">👤 {item.requester || "알 수 없음"}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : showAnalysisHistory && viewingHistoryItem ? (
              /* 특정 분석 결과 다시 보기 */
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setViewingHistoryItem(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <div>
                    <span className="text-sm font-semibold text-gray-700">
                      {AGENT_OPTIONS.find((a) => a.type === viewingHistoryItem.agentType)?.name || "속성 분석형"} 결과
                    </span>
                    <span className="text-xs text-gray-400 ml-2">👤 {viewingHistoryItem.requester}</span>
                  </div>
                </div>
                {viewingHistoryItem.agentResult
                  ? <AgentAnalysisResultComponent
                      result={viewingHistoryItem.agentResult}
                      onAddIdea={onAddIdea ? (t, c, snap?) => onAddIdea(t, c, CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)], "ai", [], snap) : undefined}
                      onApplyImage={onApplyImage}
                      onUpdateResult={onUpdateHistory ? (updated) => onUpdateHistory(viewingHistoryItem.id, updated) : undefined}
                    />
                  : viewingHistoryItem.result
                    ? <AnalysisResult result={viewingHistoryItem.result} />
                    : null}
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4" />
                <p className="text-gray-600 font-medium text-sm">AI가 분석 중입니다...</p>
                <p className="text-gray-400 text-xs mt-1">잠시만 기다려주세요</p>
              </div>
            ) : showResult ? (
              /* 분석 결과 표시 */
              <>
                {analysisHistory[0]?.requester && (
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <span className="text-xs text-gray-400">👤</span>
                    <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{analysisHistory[0].requester}</span>님이 요청</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">{new Date(analysisHistory[0].timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {agentAnalysisResult
                  ? <AgentAnalysisResultComponent result={agentAnalysisResult} onAddIdea={onAddIdea ? (t, c, snap?) => onAddIdea(t, c, CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)], "ai", [], snap) : undefined} onApplyImage={onApplyImage} />
                  : analysisResult
                    ? <AnalysisResult result={analysisResult} />
                    : null}
              </>
            ) : !showAnalysisHistory ? (
              /* 초기 상태 - AI 말풍선 그리팅 + 에이전트 목록 */
              <div className="pt-2">
                {/* AI 말풍선 */}
                <div className="flex items-start gap-2.5 px-4">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <span className="text-base">🤖</span>
                  </div>
                  <div className="flex-1 bg-purple-50 border border-purple-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                      안녕하세요! 아이디어 분석을 도와드릴게요.
                    </p>
                    {selectedCategory !== "all" ? (() => {
                      const cat = IDEA_CATEGORIES.find((c) => c.id === selectedCategory);
                      return cat ? (
                        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-purple-100">
                          <span className="text-base">{cat.emoji}</span>
                          <span className="text-xs font-semibold" style={{ color: cat.text }}>
                            {cat.label}
                          </span>
                          <span className="text-xs text-gray-500">아이디어만 분석합니다</span>
                        </div>
                      ) : null;
                    })() : (
                      <p className="text-sm text-gray-600 mt-1">
                        분석 방식을 선택해주세요 👇
                      </p>
                    )}
                    {selectedCategory !== "all" && (
                      <p className="text-sm text-gray-600 mt-2">분석 방식을 선택해주세요 👇</p>
                    )}
                  </div>
                </div>

                {/* 에이전트 목록 (pill 스타일) */}
                <div className="mt-3">
                  <AgentListItems />
                </div>

                {/* 실시간 검색 토글 */}
                <div className="px-4 mt-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setUseSearch((v) => !v)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      useSearch
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="text-base">🔍</span>
                    <div className="flex-1 text-left">
                      <div className={`text-xs font-semibold ${useSearch ? "text-green-700" : "text-gray-600"}`}>
                        실시간 검색 기반 분석
                        {useSearch && <span className="ml-1.5 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">ON</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {useSearch ? "네이버 검색 자료를 참고해 더 정확하게 분석해요" : "켜면 네이버 실시간 검색 결과를 참고해요"}
                      </div>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${useSearch ? "bg-green-500" : "bg-gray-200"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${useSearch ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                  </button>
                </div>

                <div className="px-4">
                  <FileAttachSection />
                </div>
              </div>
            ) : null}

            {/* ── AI 채팅 메시지 영역 ── */}
            {aiChatMessages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center text-xs">💬</span>
                  AI와의 대화
                </p>
                {aiChatMessages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isAI ? "" : "items-end"}`}>
                    {msg.isAI ? (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs">🤖</span>
                        </div>
                        <div className={`max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed prose prose-xs max-w-none ${
                          msg.isError ? "bg-red-50 text-red-700 border border-red-100" : "bg-purple-50 text-gray-800 border border-purple-100"
                        }`}>
                          <ReactMarkdown
                            components={{
                              p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              ul: ({children}) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li className="leading-relaxed">{children}</li>,
                              hr: () => <hr className="border-purple-200 my-2" />,
                              h1: ({children}) => <p className="font-bold text-sm mb-1">{children}</p>,
                              h2: ({children}) => <p className="font-bold mb-1">{children}</p>,
                              h3: ({children}) => <p className="font-semibold mb-0.5">{children}</p>,
                              code: ({children}) => <code className="bg-purple-100 px-1 rounded text-xs font-mono">{children}</code>,
                            }}
                          >
                            {msg.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed text-white"
                        style={{ backgroundColor: "#6366f1" }}
                      >
                        {msg.message}
                      </div>
                    )}
                    <span className="text-xs text-gray-300 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {isAIResponding && (
                  <div className="flex items-center gap-2 pl-8">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-gray-400">AI가 답변 중...</span>
                  </div>
                )}
                <div ref={aiChatEndRef} />
              </div>
            )}
          </div>
          </div>
        )}

        {/* ── 채팅 탭 ── */}
        {activeTab === "chat" && (
          <>
            {/* 내역 목록 보기 */}
            {showHistory && !viewingSession ? (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-700">채팅 내역</span>
                </div>
                {savedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="text-3xl mb-3">📭</div>
                    <p className="text-gray-500 text-sm font-medium">저장된 내역이 없어요</p>
                    <p className="text-gray-400 text-xs mt-1">새 채팅을 시작하면 이전 내용이 여기 저장돼요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 전체 삭제 버튼 */}
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={() => {
                          if (confirm("채팅 내역을 전체 삭제할까요?")) {
                            setSavedSessions([]);
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                        전체 삭제
                      </button>
                    </div>
                    {[...savedSessions].reverse().map((session) => (
                      <div key={session.id} className="flex items-stretch gap-2">
                        <button
                          onClick={() => setViewingSession(session)}
                          className="flex-1 text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500">{session.label}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="group-hover:stroke-blue-400">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-700 truncate">
                            {session.messages[0]?.message || "이미지"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{session.messages.length}개 메시지</p>
                        </button>
                        {/* 개별 삭제 버튼 */}
                        <button
                          onClick={() => setSavedSessions((prev) => prev.filter((s) => s.id !== session.id))}
                          className="px-2.5 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                          title="이 내역 삭제"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : showHistory && viewingSession ? (
              /* 특정 세션 내용 보기 */
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setViewingSession(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-700">{viewingSession.label}</span>
                </div>
                {viewingSession.messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5 opacity-80">
                    <span className="text-xs font-semibold px-1" style={{ color: msg.userColor || "#6b7280" }}>{msg.userName}</span>
                    {msg.imageUrl ? (
                      <img src={msg.imageUrl} alt="shared" className="w-full rounded-xl border border-gray-100 shadow-sm cursor-pointer object-contain" onClick={() => window.open(msg.imageUrl, "_blank")} />
                    ) : (
                      <div className="inline-block max-w-[280px] rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed"
                        style={{ backgroundColor: msg.userColor || "#E5E7EB", color: msg.userColor === "#4F48ED" ? "#ffffff" : "#1f2937" }}>
                        {msg.message}
                      </div>
                    )}
                    <span className="text-xs text-gray-300 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* 현재 채팅 */
              <div className="p-4 space-y-3">
                {currentMessages.length === 0 ? (
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
                    {currentMessages.map((msg) => (
                      <div key={msg.id} className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold px-1" style={{ color: msg.userColor || "#6b7280" }}>{msg.userName}</span>
                        {msg.imageUrl ? (
                          <img src={msg.imageUrl} alt="shared" className="w-full rounded-xl border border-gray-100 shadow-sm cursor-pointer object-contain" onClick={() => window.open(msg.imageUrl, "_blank")} />
                        ) : (
                          <div className="inline-block max-w-[280px] rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed"
                            style={{ backgroundColor: msg.userColor || "#E5E7EB", color: msg.userColor === "#4F48ED" ? "#ffffff" : "#1f2937" }}>
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
          </>
        )}

        {/* ── 🎤 회의 탭 ── */}
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

      {/* ── 하단 영역 ── */}

      {/* 채팅 탭 - 입력창 */}
      {activeTab === "chat" && !showHistory && (
        <div className="border-t border-gray-100 p-3">
          {/* 새 채팅 / 내역 버튼 */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 채팅
            </button>
            <button
              onClick={() => { setShowHistory(true); setViewingSession(null); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              내역 {savedSessions.length > 0 && <span className="bg-gray-200 text-gray-600 rounded-full px-1.5">{savedSessions.length}</span>}
            </button>
          </div>
          <div className="flex items-center gap-2">
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

      {/* 분석 탭 하단 - AI 채팅 입력창 (피그마 디자인) */}
      {activeTab === "analysis" && (
        <div className="border-t border-gray-100 px-3 py-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200">
            <button
              onClick={() => setShowAgentList(v => !v)}
              className="flex-shrink-0 px-3 py-1.5 bg-blue-500 text-white rounded-full text-xs font-semibold hover:bg-blue-600 transition-colors"
            >
              {showAgentList
                ? "닫기"
                : (AGENT_OPTIONS.find(a => a.type === (agentAnalysisResult as any)?.agentType)?.name ?? "AI 에이전트 선택")}
            </button>
            <input
              type="text"
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              onKeyDown={handleAIKeyDown}
              placeholder="AI에게 질문하거나 지시해보세요..."
              disabled={isAIResponding || isAnalyzing}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400 text-gray-800 disabled:opacity-50"
            />
            <button
              onClick={handleSendAIChat}
              disabled={!aiInputText.trim() || isAIResponding || isAnalyzing}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 분석 탭 하단 - 결과 있을 때: 처음으로 + 다시 분석하기 두 버튼 */}
      {activeTab === "analysis" && !isAnalyzing && showResult && (
        <div className="border-t border-gray-100 p-3">
          {showAgentList ? (
            /* 에이전트 재선택 목록 */
            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">분석 에이전트 선택</span>
                <button
                  onClick={() => setShowAgentList(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <AgentListItems compact />
            </div>
          ) : (
            /* 처음으로 + 다시 분석하기 */
            <div className="flex gap-2">
              {/* 버튼 1: 처음으로 */}
              <button
                onClick={() => {
                  setShowInitial(true);
                  setShowAgentList(false);
                }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500
                           hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                처음으로
              </button>
              {/* 버튼 2: 다시 분석하기 */}
              <button
                onClick={() => setShowAgentList(true)}
                className="flex-1 py-2 rounded-lg border border-purple-200 text-xs font-medium text-purple-600
                           hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4a.998.998 0 00-.8-.976C22.094 3.01 17.9 2 12 2S1.906 3.01 1.8 3.024A1 1 0 001 4c0 .4.24.76.6.92L10 9.5V19a1 1 0 00.553.894l4 2A1 1 0 0016 21v-11.5l8.4-4.58A1 1 0 0023 4z" />
                </svg>
                다시 분석하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIPanel;
