import React, { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "./socket";
import { Idea, IdeaComment, AnalysisResult, AgentAnalysisResult, ChatMessage, AgentType, CARD_COLORS, AnalysisFile, IdeaCategory, IdeaAttachment, AnalysisHistoryItem } from "./types";
import Board from "./components/Board";
import AIPanel from "./components/AIPanel";

const COLOR_OPTIONS = [
  { value: "#E5E7EB", label: "옅은 회색" },
  { value: "#4F48ED", label: "보라" },
];

const LoginModal: React.FC<{ onJoin: (userName: string, roomId: string, color: string) => void }> = ({ onJoin }) => {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("room-1");
  const [selectedColor, setSelectedColor] = useState("#E5E7EB");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    onJoin(userName.trim(), roomId.trim() || "room-1", selectedColor);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">협업 화이트보드</h1>
          <p className="text-blue-100 text-sm mt-1">팀과 함께 아이디어를 공유하세요</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">이름 *</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동" maxLength={20} autoFocus
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">방 ID</label>
            <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)}
              placeholder="room-1" maxLength={30}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            <p className="text-xs text-gray-400 mt-1">같은 방 ID를 입력하면 실시간으로 공유됩니다</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">내 컬러</label>
            <div className="flex items-center gap-3">
              {COLOR_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSelectedColor(opt.value)} title={opt.label}
                  className="w-8 h-8 rounded-full transition-all flex-shrink-0"
                  style={{
                    backgroundColor: opt.value,
                    border: selectedColor === opt.value ? `3px solid #4F48ED` : `2px solid #d1d5db`,
                    boxShadow: selectedColor === opt.value ? "0 0 0 2px #93c5fd" : "none",
                  }} />
              ))}
              <span className="text-xs text-gray-500">{COLOR_OPTIONS.find((o) => o.value === selectedColor)?.label}</span>
            </div>
          </div>
          <button type="submit" disabled={!userName.trim()}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400
                       text-white rounded-xl text-sm font-bold transition-all shadow-sm mt-2">
            입장하기
          </button>
        </form>
      </div>
    </div>
  );
};

function App() {
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState("");
  const [userColor, setUserColor] = useState("#E5E7EB");
  const [roomId, setRoomId] = useState("");

  const joinInfoRef = useRef<{ roomId: string; userName: string; userColor: string } | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const ideasRef = useRef<Idea[]>([]);
  const [users, setUsers] = useState<{ name: string; color: string }[]>([]);
  const [topic, setTopic] = useState("");
  const [topicFiles, setTopicFiles] = useState<AnalysisFile[]>([]);
  const [sectionGroups, setSectionGroups] = useState<{ title: string; ideaIds: string[] }[]>([]);
  const [initialSections, setInitialSections] = useState<any[]>([]);
  const [initialCanvasImages, setInitialCanvasImages] = useState<any[]>([]);
  const [pendingCanvasImage, setPendingCanvasImage] = useState<string | null>(null);
  const [focusedIdea, setFocusedIdea] = useState<Idea | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [agentAnalysisResult, setAgentAnalysisResult] = useState<AgentAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const pendingAnalysisRef = useRef<{ requester: string; agentType: string | null }>({ requester: "", agentType: null });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(null), 5000);
  }, []);

  useEffect(() => {
    ideasRef.current = ideas;
  }, [ideas]);

  const handleJoin = useCallback((name: string, room: string, color: string) => {
    const socket = getSocket();
    setUserName(name);
    setUserColor(color);
    setRoomId(room);
    joinInfoRef.current = { roomId: room, userName: name, userColor: color };
    socket.emit("join-room", { roomId: room, userName: name, userColor: color });
    setJoined(true);
  }, []);

  useEffect(() => {
    if (!joined) return;
    const socket = getSocket();

    const rejoinRoom = () => {
      if (joinInfoRef.current) {
        const { roomId: r, userName: u, userColor: c } = joinInfoRef.current;
        socket.emit("join-room", { roomId: r, userName: u, userColor: c });
        if (ideasRef.current.length > 0) {
          socket.emit("ideas-sync", ideasRef.current);
        }
      }
    };

    socket.on("connect", rejoinRoom);
    socket.on("reconnect", rejoinRoom);

    socket.on("room-state", ({ ideas: roomIdeas, users: roomUsers, messages: roomMessages, sections: roomSections, analysisResults, canvasImages: roomCanvasImages }: { ideas: Idea[]; users: { name: string; color: string }[]; messages?: ChatMessage[]; sections?: any[]; analysisResults?: AnalysisHistoryItem[]; canvasImages?: any[] }) => {
      setIdeas(roomIdeas);
      setUsers(roomUsers);
      if (roomMessages && roomMessages.length > 0) {
        setChatMessages(roomMessages);
      }
      setInitialSections(roomSections || []);
      setInitialCanvasImages(roomCanvasImages || []);
      if (analysisResults && analysisResults.length > 0) {
        setAnalysisHistory(analysisResults);
        // 가장 최근 결과를 현재 결과로 표시
        const latest = analysisResults[0];
        if (latest.agentResult) setAgentAnalysisResult(latest.agentResult);
        else if (latest.result) setAnalysisResult(latest.result);
      }
    });

    socket.on("idea-added", (idea: Idea) => {
      setIdeas((prev) => prev.find((i) => i.id === idea.id) ? prev : [...prev, idea]);
    });

    socket.on("idea-deleted", ({ ideaId }: { ideaId: string }) => {
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    });

    socket.on("idea-moved", ({ ideaId, x, y }: { ideaId: string; x: number; y: number }) => {
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, x, y } : i));
    });

    socket.on("idea-resized", ({ ideaId, width }: { ideaId: string; width: number }) => {
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, width } : i));
    });

    socket.on("idea-updated", ({ ideaId, title, content, category, color, aiImageUrl, attachments }: { ideaId: string; title: string; content: string; category?: IdeaCategory; color?: string; aiImageUrl?: string; attachments?: IdeaAttachment[] }) => {
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, title, content, ...(category ? { category } : {}), ...(color ? { color } : {}), ...(aiImageUrl !== undefined ? { aiImageUrl } : {}), ...(attachments !== undefined ? { attachments } : {}) } : i));
    });

    socket.on("comment-added", ({ ideaId, comment }: { ideaId: string; comment: IdeaComment }) => {
      setIdeas((prev) => prev.map((i) =>
        i.id === ideaId ? { ...i, comments: [...(i.comments ?? []), comment] } : i
      ));
    });

    socket.on("analysis-started", ({ requester, agentType }: { requester: string; agentType: string | null }) => {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setAgentAnalysisResult(null);
      pendingAnalysisRef.current = { requester, agentType };
    });

    socket.on("analysis-result", (result: AnalysisResult & { agentType?: string; _meta?: { requester: string; agentType: string | null; timestamp: string; dbId?: number } }) => {
      setIsAnalyzing(false);
      const meta = result._meta || pendingAnalysisRef.current;
      const isAgent = !!(result.agentType);
      const historyItem: AnalysisHistoryItem = {
        id: `${Date.now()}-${Math.random()}`,
        dbId: result._meta?.dbId,
        agentType: (meta.agentType || result.agentType || null) as AgentType,
        requester: meta.requester || "",
        timestamp: (result._meta?.timestamp) || new Date().toISOString(),
        result: isAgent ? null : result,
        agentResult: isAgent ? result as unknown as AgentAnalysisResult : null,
      };
      setAnalysisHistory((prev) => [historyItem, ...prev]);
      if (isAgent) {
        setAgentAnalysisResult(result as unknown as AgentAnalysisResult);
      } else {
        setAnalysisResult(result);
      }
    });

    socket.on("analysis-result-deleted", ({ dbId }: { dbId: number }) => {
      setAnalysisHistory((prev) => prev.filter((item) => item.dbId !== dbId));
    });

    socket.on("analysis-result-updated", ({ id, agentResult }: { id: string; agentResult: AgentAnalysisResult }) => {
      setAnalysisHistory((prev) => {
        const updated = prev.map(item => item.id === id ? { ...item, agentResult } : item);
        // 현재 표시 중인 결과(history[0])가 업데이트된 경우 agentAnalysisResult도 동기화
        if (prev[0]?.id === id) setAgentAnalysisResult(agentResult);
        return updated;
      });
    });

    socket.on("analysis-error", ({ message }: { message: string }) => {
      setIsAnalyzing(false);
      showError(message);
    });

    socket.on("user-joined", ({ users: updatedUsers }: { users: { name: string; color: string }[] }) => {
      setUsers(updatedUsers);
    });

    socket.on("user-left", ({ users: updatedUsers }: { users: { name: string; color: string }[] }) => {
      setUsers(updatedUsers);
    });

    socket.on("topic-changed", ({ topic: newTopic }: { topic: string }) => {
      setTopic(newTopic);
    });

    socket.on("chat-message", ({
      userName: msgUser, message, imageUrl, userColor: msgColor, timestamp,
    }: { userName: string; message: string; imageUrl?: string; userColor?: string; timestamp: string }) => {
      setChatMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, userName: msgUser, message, imageUrl, userColor: msgColor, timestamp, isAI: false },
      ]);
    });

    socket.on("chat-messages-cleared", () => {
      setChatMessages([]);
    });


    socket.on("ai-response", ({ message, timestamp, isError }: { message: string; timestamp: string; isError?: boolean }) => {
      setIsAIResponding(false);
      setAiChatMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}-${Math.random()}`, userName: "AI", message, timestamp, isAI: true, isError },
      ]);
    });

    return () => {
      socket.off("connect");
      socket.off("reconnect");
      socket.off("room-state");
      socket.off("idea-added");
      socket.off("idea-deleted");
      socket.off("idea-moved");
      socket.off("idea-resized");
      socket.off("idea-updated");
      socket.off("analysis-started");
      socket.off("analysis-result");
      socket.off("analysis-result-deleted");
      socket.off("analysis-result-updated");
      socket.off("analysis-error");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("topic-changed");
      socket.off("chat-message");
      socket.off("chat-messages-cleared");
      socket.off("ai-response");
    };
  }, [joined, showError]);

  const handleAddIdea = useCallback((title: string, content: string, color: string, category: IdeaCategory, attachments: IdeaAttachment[], snapshot?: import("./types").AnalysisSnapshot) => {
    const socket = getSocket();
    const idea: Idea = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title, content, author: userName,
      color: color || CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
      createdAt: new Date().toISOString(),
      category,
      attachments,
      ...(snapshot ? { analysisSnapshot: snapshot } : {}),
    };
    setIdeas((prev) => [...prev, idea]); // 낙관적 업데이트 (서버 응답 전에 즉시 반영)
    socket.emit("idea-added", idea);
  }, [userName]);

  const handleDeleteIdea = useCallback((ideaId: string) => {
    getSocket().emit("idea-deleted", { ideaId });
  }, []);

  const handleRestoreIdeas = useCallback((items: Array<{ idea: Idea; pos: { x: number; y: number } }>) => {
    items.forEach(({ idea }) => {
      setIdeas(prev => prev.some(i => i.id === idea.id) ? prev : [...prev, idea]);
      getSocket().emit("idea-added", idea);
    });
  }, []);

  const handleEditIdea = useCallback((ideaId: string, title: string, content: string, category: IdeaCategory, color: string, attachments?: IdeaAttachment[]) => {
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, title, content, category, color, ...(attachments !== undefined ? { attachments } : {}) } : i));
    getSocket().emit("idea-updated", { ideaId, title, content, category, color, ...(attachments !== undefined ? { attachments } : {}) });
  }, []);

  // 히스토리 아이템 내용 수정 (인라인 편집)
  const handleUpdateHistory = useCallback((id: string, updated: AgentAnalysisResult) => {
    setAnalysisHistory(prev => prev.map(item =>
      item.id === id ? { ...item, agentResult: updated } : item
    ));
    // 다른 팀원에게 실시간 동기화
    getSocket().emit("analysis-result-update", { id, agentResult: updated });
  }, []);

  const handleDeleteHistory = useCallback((dbId: number) => {
    getSocket().emit("analysis-result-delete", { dbId });
    // 낙관적 업데이트 (서버 응답 기다리지 않고 즉시 제거)
    setAnalysisHistory(prev => prev.filter(item => item.dbId !== dbId));
  }, []);

  // AI 분석 이미지를 보드 카드에 적용
  const handleApplyImage = useCallback((_ideaName: string, imageUrl: string) => {
    setPendingCanvasImage(imageUrl);
  }, []);

  const handleAddComment = useCallback((ideaId: string, text: string) => {
    const comment: IdeaComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author: userName,
      text,
      createdAt: new Date().toISOString(),
    };
    // 낙관적 업데이트
    setIdeas((prev) => prev.map((i) =>
      i.id === ideaId ? { ...i, comments: [...(i.comments ?? []), comment] } : i
    ));
    getSocket().emit("comment-added", { ideaId, comment });
  }, [userName]);

  const handleTopicChange = useCallback((newTopic: string) => {
    setTopic(newTopic);
    getSocket().emit("topic-changed", { topic: newTopic });
  }, []);

  // 분석 요청 (AI가 보드에 추가한 카드는 분석 대상에서 제외)
  const handleRequestAnalysis = useCallback((agentType: AgentType, files?: AnalysisFile[], useSearch?: boolean, filesOnly?: boolean, filteredSectionGroups?: { title: string; ideaIds: string[] }[]) => {
    const excludeIds = ideas.filter((i: any) => i.analysisSnapshot).map((i: any) => i.id);
    // filteredSectionGroups가 있으면 그걸 우선, 없으면 전체 섹션
    const effectiveSections = filteredSectionGroups !== undefined
      ? (filteredSectionGroups.length > 0 ? filteredSectionGroups : undefined)
      : (sectionGroups.length > 0 ? sectionGroups : undefined);
    getSocket().emit("analysis-requested", {
      agentType,
      userMessage: "",
      files: [...topicFiles, ...(files || [])],
      categoryFilter: null,
      useSearch: useSearch || false,
      topic,
      excludeIds,
      filesOnly: filesOnly || false,
      sectionGroups: effectiveSections,
    });
  }, [topic, topicFiles, ideas, sectionGroups]);

  // 섹션 분석 요청 - 특정 아이디어 ID만 필터링 (AI 결과 카드 제외)
  const handleSectionAnalysis = useCallback((sectionIdeas: Idea[], agentType: AgentType) => {
    const filtered = sectionIdeas.filter((i: any) => !i.analysisSnapshot);
    if (filtered.length === 0) return;
    getSocket().emit("analysis-requested", {
      agentType,
      userMessage: "",
      files: [],
      ideaIds: filtered.map(i => i.id),
      useSearch: false,
      topic,
    });
  }, [topic]);

  const handleSendChat = useCallback((message: string, imageUrl?: string) => {
    getSocket().emit("chat-message", { message, imageUrl, userColor });
  }, [userColor]);

  const handleSendAIMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    setAiChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}-${Math.random()}`, userName, message, timestamp: new Date().toISOString(), isAI: false, userColor },
    ]);
    setIsAIResponding(true);
    getSocket().emit("user-message", {
      message,
      agentType: null,
      contextIdea: focusedIdea ? { title: focusedIdea.title, content: focusedIdea.content } : null,
    });
  }, [userName, userColor, focusedIdea]);

  const handleClearChat = useCallback(() => {
    setChatMessages([]);
    getSocket().emit("chat-messages-clear");
  }, []);

  if (!joined) return <LoginModal onJoin={handleJoin} />;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {errorBanner && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorBanner}
          <button onClick={() => setErrorBanner(null)} className="ml-1 opacity-70 hover:opacity-100">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Board
          ideas={ideas}
          userName={userName}
          roomId={roomId}
          users={users}
          topic={topic}
          onTopicChange={handleTopicChange}
          onTopicFilesChange={setTopicFiles}
          pendingCanvasImage={pendingCanvasImage}
          onCanvasImageAdded={() => setPendingCanvasImage(null)}
          onFocusedIdeaChange={setFocusedIdea}
          onAddIdea={handleAddIdea}
          onDeleteIdea={handleDeleteIdea}
          onRestoreIdeas={handleRestoreIdeas}
          onEditIdea={handleEditIdea}
          onAddComment={handleAddComment}
          onSectionAnalysis={handleSectionAnalysis}
          onSectionGroupsChange={setSectionGroups}
          initialSections={initialSections}
          initialCanvasImages={initialCanvasImages}
        />
      </div>

      <AIPanel
        analysisResult={analysisResult}
        agentAnalysisResult={agentAnalysisResult}
        isAnalyzing={isAnalyzing}
        analysisHistory={analysisHistory}
        chatMessages={chatMessages}
        aiChatMessages={aiChatMessages}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
        onSendChat={handleSendChat}
        onSendAIMessage={handleSendAIMessage}
        onRequestAnalysis={handleRequestAnalysis}
        sectionGroups={sectionGroups}
        isAIResponding={isAIResponding}
        onClearChat={handleClearChat}
        onAddIdea={handleAddIdea}
        onApplyImage={handleApplyImage}
        onUpdateHistory={handleUpdateHistory}
        onDeleteHistory={handleDeleteHistory}
      />
    </div>
  );
}

export default App;
