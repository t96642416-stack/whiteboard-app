import React, { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "./socket";
import { Idea, AnalysisResult, AgentAnalysisResult, ChatMessage, AgentType, CARD_COLORS } from "./types";
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
          <div className="w-16 h-16 rounded-2xl bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
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
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedColor(opt.value)}
                  title={opt.label}
                  className="w-8 h-8 rounded-full transition-all flex-shrink-0"
                  style={{
                    backgroundColor: opt.value,
                    border: selectedColor === opt.value ? `3px solid #3b82f6` : `2px solid #d1d5db`,
                    boxShadow: selectedColor === opt.value ? "0 0 0 2px #93c5fd" : "none",
                  }}
                />
              ))}
              <span className="text-xs text-gray-500">
                {COLOR_OPTIONS.find((o) => o.value === selectedColor)?.label}
              </span>
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

  // 재연결 시 join-room 재전송을 위한 ref
  const joinInfoRef = useRef<{ roomId: string; userName: string; userColor: string } | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [users, setUsers] = useState<{ name: string; color: string }[]>([]);
  const [topic, setTopic] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [agentAnalysisResult, setAgentAnalysisResult] = useState<AgentAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(null);
  const [isAIResponding, _setIsAIResponding] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(null), 5000);
  }, []);

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

    // 소켓 재연결 시 자동으로 방 재참가
    socket.on("connect", () => {
      if (joinInfoRef.current) {
        const { roomId: r, userName: u, userColor: c } = joinInfoRef.current;
        socket.emit("join-room", { roomId: r, userName: u, userColor: c });
      }
    });

    socket.on("room-state", ({ ideas: roomIdeas, users: roomUsers }: { ideas: Idea[]; users: { name: string; color: string }[] }) => {
      setIdeas(roomIdeas);
      setUsers(roomUsers);
    });

    socket.on("idea-added", (idea: Idea) => {
      setIdeas((prev) => prev.find((i) => i.id === idea.id) ? prev : [...prev, idea]);
    });

    socket.on("idea-deleted", ({ ideaId }: { ideaId: string }) => {
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    });

    socket.on("analysis-started", () => {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setAgentAnalysisResult(null);
    });

    socket.on("analysis-result", (result: AnalysisResult & { agentType?: string }) => {
      setIsAnalyzing(false);
      if (result.agentType) {
        setAgentAnalysisResult(result as unknown as AgentAnalysisResult);
      } else {
        setAnalysisResult(result);
      }
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

    // 주제 변경 수신
    socket.on("topic-changed", ({ topic: newTopic }: { topic: string }) => {
      setTopic(newTopic);
    });

    // 순수 채팅 메시지 수신
    socket.on("chat-message", ({
      userName: msgUser, message, imageUrl, userColor: msgColor, timestamp,
    }: { userName: string; message: string; imageUrl?: string; userColor?: string; timestamp: string }) => {
      setChatMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, userName: msgUser, message, imageUrl, userColor: msgColor, timestamp, isAI: false },
      ]);
    });

    return () => {
      socket.off("connect");
      socket.off("room-state");
      socket.off("idea-added");
      socket.off("idea-deleted");
      socket.off("analysis-started");
      socket.off("analysis-result");
      socket.off("analysis-error");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("topic-changed");
      socket.off("chat-message");
    };
  }, [joined, showError]);

  const handleAddIdea = useCallback((title: string, content: string, color: string) => {
    const socket = getSocket();
    const idea: Idea = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title, content, author: userName,
      color: color || CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
      createdAt: new Date().toISOString(),
    };
    socket.emit("idea-added", idea);
  }, [userName]);

  const handleDeleteIdea = useCallback((ideaId: string) => {
    getSocket().emit("idea-deleted", { ideaId });
  }, []);

  const handleTopicChange = useCallback((newTopic: string) => {
    setTopic(newTopic);
    getSocket().emit("topic-changed", { topic: newTopic });
  }, []);

  // 속성 분석형 선택 시 자동으로 분석 요청
  const handleRequestAnalysis = useCallback((agentType: AgentType) => {
    getSocket().emit("analysis-requested", { agentType, userMessage: "" });
  }, []);

  // 순수 채팅 전송 (AI 응답 없음)
  const handleSendChat = useCallback((message: string, imageUrl?: string) => {
    getSocket().emit("chat-message", { message, imageUrl, userColor });
  }, [userColor]);

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
          onAddIdea={handleAddIdea}
          onDeleteIdea={handleDeleteIdea}
        />
      </div>

      <AIPanel
        analysisResult={analysisResult}
        agentAnalysisResult={agentAnalysisResult}
        isAnalyzing={isAnalyzing}
        chatMessages={chatMessages}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
        onSendChat={handleSendChat}
        onRequestAnalysis={handleRequestAnalysis}
        isAIResponding={isAIResponding}
      />
    </div>
  );
}

export default App;
