import React, { useState, useEffect, useCallback, useRef } from "react";
import { getSocket, BACKEND_URL } from "./socket";
import { Idea, IdeaComment, AnalysisResult, AgentAnalysisResult, ChatMessage, AgentType, CARD_COLORS, AnalysisFile, IdeaCategory, IdeaAttachment, AnalysisHistoryItem } from "./types";
import Board from "./components/Board";
import AIPanel from "./components/AIPanel";
import { LAZY_IMAGE, fillLazyImages } from "./utils/lazyImages";

const COLOR_OPTIONS = [
  { value: "#E5E7EB", label: "옅은 회색" },
  { value: "#4F48ED", label: "보라" },
];

// 관리자가 만든 방인지 확인 (없거나 마감된 방이면 오류 메시지)
async function checkRoom(roomId: string): Promise<{ title: string | null; error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}`);
    const body = await res.json().catch(() => ({}));
    return { title: body.title ?? null, error: body.error ?? (res.ok ? null : "방 정보를 확인하지 못했습니다.") };
  } catch {
    return { title: null, error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
}

// 초대 링크(?room=방코드)로 들어온 경우 방이 미리 정해짐
const invitedRoom = new URLSearchParams(window.location.search).get("room")?.trim() || null;

const LoginModal: React.FC<{ onJoin: (userName: string, roomId: string, color: string) => void; joinError: string | null }> = ({ onJoin, joinError }) => {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState(invitedRoom ?? "");
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#E5E7EB");

  useEffect(() => {
    if (!invitedRoom) return;
    checkRoom(invitedRoom).then(({ title, error }) => { setRoomTitle(title); setRoomError(error); });
  }, []);

  useEffect(() => { if (joinError) setRoomError(joinError); }, [joinError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const room = roomId.trim();
    if (!userName.trim() || !room) return;
    setChecking(true);
    const { error } = await checkRoom(room);
    setChecking(false);
    if (error) { setRoomError(error); return; }
    // 참여 코드 표기 통일: "p 01" / "P01 " → "P01" (대소문자·공백 차이로 다른 참가자로 집계되지 않도록)
    onJoin(userName.replace(/\s+/g, "").toUpperCase(), room, selectedColor);
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">참여 코드 *</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
              placeholder="안내받은 코드 (예: P01)" maxLength={20} autoFocus autoCapitalize="characters" autoComplete="off"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800
                         placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>
          {invitedRoom ? (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-500">참여할 방</p>
              <p className="text-sm font-bold text-indigo-900 mt-0.5">{roomTitle || invitedRoom}</p>
              {roomTitle && <p className="text-xs text-indigo-400 mt-0.5">방 코드 {invitedRoom}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">방 코드 *</label>
              <input type="text" value={roomId} onChange={(e) => { setRoomId(e.target.value); setRoomError(null); }}
                placeholder="안내받은 방 코드" maxLength={40} autoComplete="off"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800
                           placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
              <p className="text-xs text-gray-400 mt-1">관리자에게 받은 링크로 들어오면 자동으로 입력됩니다</p>
            </div>
          )}
          {roomError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{roomError}</div>
          )}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold text-amber-900 mb-1.5">참여 전 확인해주세요</p>
            <ul className="text-xs text-amber-900 space-y-1 list-disc pl-4 leading-relaxed">
              <li>이름 대신 <b>안내받은 참여 코드</b>로 입장해주세요.</li>
              <li><b>한 사람당 한 기기</b>로 참여해주세요.</li>
              <li>아이디어는 <b>낸 사람이 직접</b> 추가해주세요. 대신 입력하면 입력한 사람의 아이디어로 기록돼요.</li>
              <li>다시 들어올 때도 <b>같은 코드</b>를 써주세요.</li>
            </ul>
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
          <button type="submit" disabled={!userName.trim() || !roomId.trim() || checking || (!!invitedRoom && !!roomError)}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400
                       text-white rounded-xl text-sm font-bold transition-all shadow-sm mt-2">
            {checking ? "확인 중…" : "입장하기"}
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
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomClosed, setRoomClosed] = useState(false);

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
    setJoinError(null);
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

    // 입장이 거절된 경우(없는 방·마감된 방) 입장 화면으로
    socket.on("join-error", ({ message }: { message: string }) => {
      joinInfoRef.current = null;
      setJoinError(message);
      setJoined(false);
    });
    // 관리자가 방을 마감한 경우
    socket.on("room-closed", () => { joinInfoRef.current = null; setRoomClosed(true); });

    socket.on("connect", rejoinRoom);
    socket.on("reconnect", rejoinRoom);

    socket.on("room-state", ({ ideas: roomIdeas, users: roomUsers, messages: roomMessages, sections: roomSections, analysisResults, canvasImages: roomCanvasImages, topic: roomTopic }: { ideas: Idea[]; users: { name: string; color: string }[]; messages?: ChatMessage[]; sections?: any[]; analysisResults?: AnalysisHistoryItem[]; canvasImages?: any[]; topic?: string }) => {
      if (roomTopic) setTopic(roomTopic);
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

    // 입장 직후 자리표시로 왔던 이미지(채팅·분석 결과)를 진짜 이미지로 채움 (캔버스 이미지는 Board에서 처리)
    socket.on("room-heavy-patch", ({ messages: fullMessages, analysisResults: fullResults }: { messages?: ChatMessage[]; analysisResults?: AnalysisHistoryItem[] }) => {
      if (fullMessages?.length) {
        setChatMessages((prev) => prev.map((m, i) => {
          const full = fullMessages[i];
          return full && full.timestamp === m.timestamp ? fillLazyImages(m, full) : m;
        }));
      }
      if (fullResults?.length) {
        setAnalysisHistory((prev) => {
          const replaced = new Map<unknown, unknown>();
          const next = prev.map((item) => {
            const full = fullResults.find((r) => (item.dbId != null && r.dbId === item.dbId) || r.id === item.id);
            if (!full) return item;
            const filled = fillLazyImages(item, full);
            if (item.agentResult && filled.agentResult !== item.agentResult) replaced.set(item.agentResult, filled.agentResult);
            if (item.result && filled.result !== item.result) replaced.set(item.result, filled.result);
            return filled;
          });
          if (replaced.size > 0) {
            setAgentAnalysisResult((cur) => (cur && replaced.has(cur) ? replaced.get(cur) as AgentAnalysisResult : cur));
            setAnalysisResult((cur) => (cur && replaced.has(cur) ? replaced.get(cur) as AnalysisResult : cur));
          }
          return next;
        });
      }
    });

    socket.on("idea-added", (idea: Idea) => {
      setIdeas((prev) => prev.find((i) => i.id === idea.id) ? prev : [...prev, idea]);
    });

    // 이미지 지연 패치 (초기 로딩 속도 개선)
    socket.on("room-images-patch", ({ ideas: patchIdeas }: { ideas: Idea[] }) => {
      setIdeas(prev => prev.map(idea => {
        const patched = patchIdeas.find(p => p.id === idea.id);
        return patched ? { ...idea, attachments: patched.attachments } : idea;
      }));
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

    socket.on("analysis-result-updated", ({ id, dbId, agentResult }: { id?: string; dbId?: number; agentResult: AgentAnalysisResult }) => {
      setAnalysisHistory((prev) => {
        const match = (item: AnalysisHistoryItem) =>
          (dbId != null && item.dbId === dbId) || (id != null && item.id === id);
        const updated = prev.map(item => match(item) ? { ...item, agentResult } : item);
        // 현재 표시 중인 결과(history[0])가 업데이트된 경우 agentAnalysisResult도 동기화
        if (prev[0] && match(prev[0])) setAgentAnalysisResult(agentResult);
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
      socket.off("join-error");
      socket.off("room-closed");
      socket.off("connect");
      socket.off("reconnect");
      socket.off("room-state");
      socket.off("room-heavy-patch");
      socket.off("idea-added");
      socket.off("room-images-patch");
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
    let dbId: number | undefined;
    setAnalysisHistory(prev => {
      const next = prev.map(item => {
        if (item.id === id) { dbId = item.dbId; return { ...item, agentResult: updated }; }
        return item;
      });
      // 현재 표시 중인 결과(history[0])가 수정된 경우 agentAnalysisResult도 업데이트
      if (prev[0]?.id === id) setAgentAnalysisResult(updated);
      return next;
    });
    // 다른 팀원에게 실시간 동기화 — 공통 식별자 dbId 우선 전송
    getSocket().emit("analysis-result-update", { id, dbId, agentResult: updated });
  }, []);

  const handleDeleteHistory = useCallback((dbId: number) => {
    getSocket().emit("analysis-result-delete", { dbId });
    // 낙관적 업데이트 (서버 응답 기다리지 않고 즉시 제거)
    setAnalysisHistory(prev => prev.filter(item => item.dbId !== dbId));
  }, []);

  // AI 분석 이미지를 보드 카드에 적용
  const handleApplyImage = useCallback((_ideaName: string, imageUrl: string) => {
    if (imageUrl === LAZY_IMAGE) return; // 아직 이미지 로딩 중
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
  const handleSectionAnalysis = useCallback((sectionIdeas: Idea[], agentType: AgentType, sectionTitle: string) => {
    const filtered = sectionIdeas.filter((i: any) => !i.analysisSnapshot);
    if (filtered.length === 0) return;
    // 섹션 제목이 있으면 sectionGroups로 전달 (AI가 섹션 이름 그대로 사용)
    const sg = sectionTitle ? [{ title: sectionTitle, ideaIds: filtered.map(i => i.id) }] : undefined;
    getSocket().emit("analysis-requested", {
      agentType,
      userMessage: "",
      files: [],
      ideaIds: filtered.map(i => i.id),
      useSearch: false,
      topic,
      sectionGroups: sg,
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

  if (roomClosed) return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="text-lg font-bold text-gray-900">세션이 종료되었습니다</h1>
        <p className="text-sm text-gray-500 mt-2">관리자가 방을 마감했습니다. 참여해 주셔서 감사합니다.</p>
      </div>
    </div>
  );

  if (!joined) return <LoginModal onJoin={handleJoin} joinError={joinError} />;

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
