import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { AgentType, AnalysisResult as AnalysisResultType, AgentAnalysisResult, ChatMessage, AGENT_OPTIONS, AnalysisFile, IdeaCategory, AnalysisHistoryItem, IdeaAttachment, CARD_COLORS, AnalysisSnapshot } from "../types";
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
  onRequestAnalysis: (agentType: AgentType, files?: AnalysisFile[], useSearch?: boolean, filesOnly?: boolean, filteredSectionGroups?: { title: string; ideaIds: string[] }[]) => void;
  sectionGroups?: { title: string; ideaIds: string[] }[];
  isAIResponding: boolean;
  onClearChat?: () => void;
  onAddIdea?: (title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[], snapshot?: AnalysisSnapshot) => void;
  onApplyImage?: (ideaName: string, imageUrl: string) => void;
  onUpdateHistory?: (id: string, updated: AgentAnalysisResult) => void;
  onDeleteHistory?: (dbId: number) => void;
}

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
  sectionGroups = [],
  isAIResponding,
  onAddIdea,
  onApplyImage,
  onUpdateHistory,
  onDeleteHistory,
  onClearChat,
}) => {
  const [selectedSections, setSelectedSections] = useState<string[] | null>(null); // null = 전체
  const [inputText, setInputText] = useState("");
  const [aiInputText, setAiInputText] = useState("");
  const [useSearch, setUseSearch] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"analysis" | "chat" | "meeting">("analysis");
  const [showAgentList, setShowAgentList] = useState(false);
  const [showInitial, setShowInitial] = useState(false);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [viewingHistoryItemId, setViewingHistoryItemId] = useState<string | null>(null);
  // analysisHistory가 업데이트될 때 항상 최신 객체를 반영하도록 파생
  const viewingHistoryItem = viewingHistoryItemId
    ? (analysisHistory.find(item => item.id === viewingHistoryItemId) ?? null)
    : null;
  const [ideaFiles, setIdeaFiles] = useState<AnalysisFile[]>([]); // role: "idea"
  const [referenceFiles, setReferenceFiles] = useState<AnalysisFile[]>([]); // role: "reference" (전사지)
  const analysisFiles = [...ideaFiles, ...referenceFiles]; // 합산 (에이전트 전달용)
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
  const analysisFileInputRef = useRef<HTMLInputElement>(null); // 아이디어 파일
  const referenceFileInputRef = useRef<HTMLInputElement>(null); // 전사지
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

  // 새 채팅 시작 (현재 내용 저장 후 초기화 + DB 삭제)
  const handleNewChat = () => {
    const current = chatMessages.slice(sessionStartIndex);
    if (current.length > 0) {
      const now = new Date();
      const label = now.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setSavedSessions((prev) => [...prev, { id: Date.now().toString(), label, messages: current }]);
    }
    setSessionStartIndex(0);
    setShowHistory(false);
    setViewingSession(null);
    // DB에서도 삭제 (새로고침 후 복원 방지)
    onClearChat?.();
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

  // 아이디어 파일 업로드 (role: "idea")
  const handleIdeaFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (ideaFiles.length >= 6) { alert("아이디어 파일은 최대 6개까지 첨부할 수 있어요"); return; }
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name}: 5MB 이하 파일만 업로드 가능해요`); return; }
      const reader = new FileReader();
      if (file.type.startsWith("image/")) {
        reader.onload = () => setIdeaFiles((prev) => prev.length >= 6 ? prev : [...prev, { name: file.name, type: "image", mimeType: file.type, content: reader.result as string, role: "idea" }]);
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => setIdeaFiles((prev) => prev.length >= 6 ? prev : [...prev, { name: file.name, type: "text", content: reader.result as string, role: "idea" }]);
        reader.readAsText(file, "utf-8");
      }
    });
    e.target.value = "";
  };

  // 전사지/참고자료 파일 업로드 (role: "reference")
  const handleReferenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (referenceFiles.length >= 2) { alert("참고자료는 최대 2개까지 첨부할 수 있어요"); return; }
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name}: 10MB 이하 파일만 업로드 가능해요`); return; }
      const reader = new FileReader();
      if (file.type.startsWith("image/")) {
        reader.onload = () => setReferenceFiles((prev) => prev.length >= 2 ? prev : [...prev, { name: file.name, type: "image", mimeType: file.type, content: reader.result as string, role: "reference" }]);
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => setReferenceFiles((prev) => prev.length >= 2 ? prev : [...prev, { name: file.name, type: "text", content: reader.result as string, role: "reference" }]);
        reader.readAsText(file, "utf-8");
      }
    });
    e.target.value = "";
  };

  const removeIdeaFile = (index: number) => setIdeaFiles((prev) => prev.filter((_, i) => i !== index));
  const removeReferenceFile = (index: number) => setReferenceFiles((prev) => prev.filter((_, i) => i !== index));


  // 에이전트 클릭 핸들러
  const handleAgentClick = (agentType: AgentType) => {
    if (agentType === null) return;
    onAgentChange(agentType);
    const filesOnly = ideaFiles.length > 0;
    // 섹션 필터: null이면 전체(undefined 전달), 선택된 섹션이 있으면 필터링해서 전달
    const filteredGroups = selectedSections === null
      ? undefined
      : sectionGroups.filter(g => selectedSections.includes(g.title));
    onRequestAnalysis(agentType, analysisFiles.length > 0 ? analysisFiles : undefined, useSearch, filesOnly, filteredGroups);
    setShowAgentList(false);
    setShowInitial(false);
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
  // 결과가 있고 초기화 요청 없을 때만 결과 표시
  const showResult = hasResult && !showInitial;

  // 에이전트별 뱃지 색상
  const AGENT_BADGE: Record<string, { bg: string; text: string }> = {
    suggestion: { bg: "#FEF3C7", text: "#D97706" },
    question:   { bg: "#EDE9FE", text: "#7C3AED" },
    emphasis:   { bg: "#FED7AA", text: "#EA580C" },
    attribute:  { bg: "#DCFCE7", text: "#16A34A" },
    guide:      { bg: "#DBEAFE", text: "#2563EB" },
    advise:     { bg: "#F3E8FF", text: "#9333EA" },
  };

  // 에이전트 목록 컴포넌트 (공용)
  const AgentListItems = ({ compact = false }: { compact?: boolean }) => (
    <div className={`space-y-2 ${compact ? "" : ""}`}>
      {AGENT_OPTIONS.map((agent) => {
        const badge = AGENT_BADGE[agent.type as string] ?? { bg: "#F3F4F6", text: "#374151" };
        return (
          <button
            key={agent.type}
            onClick={() => handleAgentClick(agent.type)}
            className={`w-full bg-white rounded-xl flex items-center gap-3 hover:shadow-sm transition-all text-left ${compact ? "px-3 py-2" : "px-3.5 py-3"}`}
          >
            <span
              className="flex-shrink-0 rounded-lg font-semibold"
              style={{
                backgroundColor: badge.bg,
                color: badge.text,
                fontSize: compact ? 11 : 12,
                padding: compact ? "3px 8px" : "4px 10px",
                minWidth: compact ? 58 : 68,
                textAlign: "center",
              }}
            >
              {agent.name}
            </span>
            <span className="text-gray-500 leading-snug" style={{ fontSize: compact ? 11 : 12 }}>
              {agent.description}
            </span>
          </button>
        );
      })}
    </div>
  );

  // 파일 목록 렌더러 (공용)
  const FileList = ({ files, onRemove, addMore, accent }: {
    files: AnalysisFile[];
    onRemove: (i: number) => void;
    addMore: () => void;
    accent: string;
  }) => (
    <div className="mt-2 space-y-1.5">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: accent + "18" }}>
          <span style={{ color: accent }} className="flex-shrink-0">
            {f.type === "image"
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          </span>
          <span className="text-gray-700 flex-1 truncate" style={{ fontSize: 11 }}>{f.name}</span>
          <button onClick={() => onRemove(i)} className="text-gray-300 hover:text-red-400 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" onClick={addMore}
        className="w-full text-center hover:opacity-80 transition-colors flex items-center justify-center gap-1"
        style={{ fontSize: 11, color: accent }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>파일 더 추가
      </button>
    </div>
  );

  // 파일 첨부 섹션 (아이디어 파일 + 전사지 두 구역)
  const FileAttachSection = () => (
    <div className="space-y-2">
      {/* 섹션 필터 — 섹션이 2개 이상일 때만 표시 */}
      {sectionGroups.length >= 2 && (
        <div className="bg-white rounded-xl px-3.5 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            <span className="text-xs font-semibold text-gray-700">분석 섹션</span>
            <span className="text-gray-400 font-normal" style={{ fontSize: 10 }}>원하는 섹션만 선택</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedSections(null)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{ backgroundColor: selectedSections === null ? "#6366f1" : "#f3f4f6", color: selectedSections === null ? "white" : "#6b7280" }}>
              전체
            </button>
            {sectionGroups.map(g => {
              const isSelected = selectedSections !== null && selectedSections.includes(g.title);
              return (
                <button key={g.title}
                  onClick={() => setSelectedSections(prev => {
                    if (prev === null) return [g.title]; // 전체 상태 → 그것만 선택
                    const next = prev.includes(g.title)
                      ? prev.filter(t => t !== g.title)
                      : [...prev, g.title];
                    return next.length === sectionGroups.length ? null : next; // 전부 선택 시 전체로
                  })}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                  style={{ backgroundColor: isSelected ? "#ede9fe" : "#f3f4f6", color: isSelected ? "#6366f1" : "#6b7280" }}>
                  {g.title}
                </button>
              );
            })}
          </div>
          {selectedSections !== null && selectedSections.length === 0 && (
            <p className="text-xs text-rose-400 mt-1.5">섹션을 1개 이상 선택해주세요</p>
          )}
        </div>
      )}
      {/* 현재 분석 모드 안내 */}
      <div className={`px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 ${ideaFiles.length > 0 ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-400"}`} style={{ fontSize: 10 }}>
        {ideaFiles.length > 0 ? (
          <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>파일 기반 분석 — 보드 카드는 제외됩니다</>
        ) : (
          <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>보드 카드 기반 분석 (아이디어 파일 추가 시 파일로 대체)</>
        )}
      </div>
      {/* hidden inputs */}
      <input ref={analysisFileInputRef} type="file" accept=".txt,.md,.csv,.json,.pdf,image/*" multiple className="hidden" onChange={handleIdeaFileUpload} />
      <input ref={referenceFileInputRef} type="file" accept=".txt,.md,.csv,.json,.pdf,image/*" multiple className="hidden" onChange={handleReferenceFileUpload} />

      {/* ① 아이디어 파일 구역 */}
      <div className="w-full bg-white rounded-xl px-3.5 py-3 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700 flex items-center gap-2" style={{ fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            아이디어 파일
            <span className="text-gray-400 font-normal" style={{ fontSize: 10 }}>각 파일 = 하나의 안(案)</span>
          </span>
          <button type="button" onClick={() => analysisFileInputRef.current?.click()}
            disabled={ideaFiles.length >= 6}
            className="font-semibold disabled:text-gray-300 transition-colors flex items-center gap-1"
            style={{ fontSize: 11, color: "#6366f1" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>추가
          </button>
        </div>
        {ideaFiles.length === 0 ? (
          <button type="button" onClick={() => analysisFileInputRef.current?.click()}
            className="mt-1.5 w-full text-left text-gray-400 hover:text-indigo-400 transition-colors" style={{ fontSize: 10 }}>
            아이디어당 1개 파일씩 첨부 (최대 6개)
          </button>
        ) : (
          <FileList files={ideaFiles} onRemove={removeIdeaFile} addMore={() => analysisFileInputRef.current?.click()} accent="#6366f1" />
        )}
      </div>

      {/* ② 전사지/참고자료 구역 */}
      <div className="w-full bg-white rounded-xl px-3.5 py-3 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700 flex items-center gap-2" style={{ fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            전사지 / 참고자료
            <span className="text-gray-400 font-normal" style={{ fontSize: 10 }}>분석 근거로만 활용</span>
          </span>
          <button type="button" onClick={() => referenceFileInputRef.current?.click()}
            disabled={referenceFiles.length >= 2}
            className="font-semibold disabled:text-gray-300 transition-colors flex items-center gap-1"
            style={{ fontSize: 11, color: "#10b981" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>추가
          </button>
        </div>
        {referenceFiles.length === 0 ? (
          <button type="button" onClick={() => referenceFileInputRef.current?.click()}
            className="mt-1.5 w-full text-left text-gray-400 hover:text-emerald-400 transition-colors" style={{ fontSize: 10 }}>
            전사지, 인터뷰 자료 등 근거 문서 (최대 2개)
          </button>
        ) : (
          <FileList files={referenceFiles} onRemove={removeReferenceFile} addMore={() => referenceFileInputRef.current?.click()} accent="#10b981" />
        )}
      </div>
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
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "#4F48ED"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
        />
      </div>

      {/* 헤더 */}
      <div className="px-4 pt-3 pb-0 border-b border-gray-100">
        {/* 상태 표시 (분석중 / 완료 / 내역) */}
        {(isAnalyzing || showResult || analysisHistory.length > 0) && (
          <div className="flex items-center justify-end mb-2">
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  {(AGENT_OPTIONS.find((a) => a.type === (agentAnalysisResult as any)?.agentType) ||
                    AGENT_OPTIONS.find((a) => a.type === analysisHistory[0]?.agentType))?.name || "속성 분석형"} 완료
                </span>
                <button onClick={() => { setShowAnalysisHistory(true); setViewingHistoryItemId(null); }}
                  className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  내역 {analysisHistory.length > 0 && <span className="bg-purple-100 text-purple-600 rounded-full px-1">{analysisHistory.length}</span>}
                </button>
              </div>
            ) : analysisHistory.length > 0 ? (
              <button onClick={() => { setShowAnalysisHistory(true); setViewingHistoryItemId(null); }}
                className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1 transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                분석 내역 <span className="bg-purple-100 text-purple-600 rounded-full px-1">{analysisHistory.length}</span>
              </button>
            ) : null}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3">
          <button
            onClick={() => { setActiveTab("analysis"); setShowAnalysisHistory(false); setViewingHistoryItemId(null); }}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all relative ${
              activeTab === "analysis" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            AI 대화
            {analysisHistory.length > 0 && activeTab !== "analysis" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-white text-xs flex items-center justify-center">
                {analysisHistory.length > 9 ? "9+" : analysisHistory.length}
              </span>
            )}
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
            회의
            {isRecording && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 분석 결과 탭 ── */}
        {activeTab === "analysis" && (
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
                    <div className="mb-3 text-gray-300"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></div>
                    <p className="text-gray-500 text-sm font-medium">저장된 분석 내역이 없어요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analysisHistory.map((item) => {
                      const agent = AGENT_OPTIONS.find((a) => a.type === item.agentType);
                      return (
                        <div key={item.id} className="relative group/item">
                          <button onClick={() => setViewingHistoryItemId(item.id)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group pr-10">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                                {agent?.name || "속성 분석형"}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="group-hover:stroke-purple-400"><path d="M9 18l6-6-6-6" /></svg>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{item.requester || "알 수 없음"}</span>
                              <span className="text-gray-200">·</span>
                              <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </button>
                          {onDeleteHistory && item.dbId != null && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (confirm("이 분석 내역을 삭제할까요?")) onDeleteHistory(item.dbId!); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover/item:opacity-100 hover:bg-red-50 transition-all"
                              title="내역 삭제"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : showAnalysisHistory && viewingHistoryItem ? (
              /* 특정 분석 결과 다시 보기 */
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setViewingHistoryItemId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <div>
                    <span className="text-sm font-semibold text-gray-700">
                      {AGENT_OPTIONS.find((a) => a.type === viewingHistoryItem.agentType)?.name || "속성 분석형"} 결과
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{viewingHistoryItem.requester}</span>
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
                    <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{analysisHistory[0].requester}</span>님이 요청</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">{new Date(analysisHistory[0].timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {agentAnalysisResult
                  ? <AgentAnalysisResultComponent result={agentAnalysisResult} onAddIdea={onAddIdea ? (t, c, snap?) => onAddIdea(t, c, CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)], "ai", [], snap) : undefined} onApplyImage={onApplyImage} onUpdateResult={onUpdateHistory && analysisHistory[0]?.id ? (updated) => onUpdateHistory(analysisHistory[0].id, updated) : undefined} />
                  : analysisResult
                    ? <AnalysisResult result={analysisResult} />
                    : null}
              </>
            ) : !showAnalysisHistory ? (
              /* 초기 상태 - Figma 디자인 */
              <div className="pt-2 space-y-3">
                {/* Ai 아이콘 (카드 밖, 상단) */}
                <div
                  className="flex items-center justify-center flex-shrink-0 relative"
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "linear-gradient(135deg, #9B6DFF 0%, #6366F1 100%)",
                    boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
                  }}
                >
                  <span className="text-white font-bold" style={{ fontSize: 17, letterSpacing: "-0.5px" }}>Ai</span>
                </div>

                {/* 메인 카드 */}
                <div
                  className="rounded-2xl"
                  style={{ backgroundColor: "#F6F6FF", border: "1.5px solid #C8C6F6", padding: "20px 20px 20px 20px" }}
                >
                  {/* 인삿말 */}
                  <p className="font-bold text-gray-900 leading-relaxed mb-4" style={{ fontSize: 13 }}>
                    안녕하세요! 아이디어 분석을 도와드릴게요.<br />
                    원하는 에이전트가 있다면 에이전트를 선택해주세요!
                  </p>

                  {/* 에이전트 목록 */}
                  <AgentListItems />

                  {/* 검색 토글 + 파일 첨부 (하단) */}
                  <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: "#C8C6F6" }}>
                    {/* 실시간 검색 토글 */}
                    <button
                      type="button"
                      onClick={() => setUseSearch((v) => !v)}
                      className="w-full bg-white rounded-xl flex items-center gap-3 px-3.5 py-2.5 hover:shadow-sm transition-all text-left"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={useSearch ? "#16A34A" : "#6366f1"} strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-700" style={{ fontSize: 12 }}>
                          실시간 검색 기반 분석
                          {useSearch && <span className="ml-1.5 bg-green-500 text-white px-1.5 py-0.5 rounded-full" style={{ fontSize: 10 }}>ON</span>}
                        </div>
                        <div className="text-gray-400 mt-0.5" style={{ fontSize: 10 }}>
                          {useSearch ? "네이버 검색 자료를 참고해 분석해요" : "켜면 네이버 실시간 검색 결과를 참고해요"}
                        </div>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-all flex items-center px-0.5 flex-shrink-0 ${useSearch ? "bg-green-500" : "bg-gray-300"}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-all ${useSearch ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                    </button>

                    {/* 파일 첨부 */}
                    <FileAttachSection />
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── AI 채팅 메시지 영역 ── */}
            {aiChatMessages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  </span>
                  AI와의 대화
                </p>
                {aiChatMessages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isAI ? "" : "items-end"}`}>
                    {msg.isAI ? (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
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
                    <div className="mb-3 text-gray-300"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
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
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F48ED" strokeWidth="1.5">
                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium text-sm mb-1">팀원들과 채팅해보세요</p>
                    <p className="text-gray-400 text-xs">이미지도 올릴 수 있어요</p>
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
                  Chrome 브라우저에서만 음성 인식이 가능해요
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
                  회의 내용 AI 분석하기
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

      {/* 분석 탭 하단 - AI 채팅 입력창 (항상 표시) */}
      {activeTab === "analysis" && (
        <div className="border-t border-gray-100 px-3 pt-2 pb-2">

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              <input
                type="text"
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                onKeyDown={handleAIKeyDown}
                placeholder="AI에게 질문하거나 지시해보세요..."
                disabled={isAIResponding || isAnalyzing}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSendAIChat}
              disabled={!aiInputText.trim() || isAIResponding || isAnalyzing}
              className="w-9 h-9 rounded-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200
                         flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={!aiInputText.trim() || isAIResponding ? "#9ca3af" : "white"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
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
