import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { analyzeIdeas, chatWithAI, IdeaInput, AnalysisFile } from "./claude";
import {
  initDb,
  dbGetIdeas,
  dbGetSections,
  dbGetMessages,
  dbUpsertIdea,
  dbUpdateAnalysisResult,
  dbUpdateIdea,
  dbDeleteIdea,
  dbMoveIdea,
  dbUpsertSection,
  dbUpdateSection,
  dbDeleteSection,
  dbInsertMessage,
  dbClearMessages,
  dbGetCanvasImages,
  dbUpsertCanvasImage,
  dbUpdateCanvasImage,
  dbDeleteCanvasImage,
  dbGetAnalysisResults,
  dbInsertAnalysisResult,
  dbDeleteAnalysisResult,
} from "./db";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 모든 origin 허용 (ngrok/터널 환경 대응)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // 이미지 첨부 파일(base64) 포함 패킷 허용 (기본 1MB → 50MB)
  maxHttpBufferSize: 50 * 1024 * 1024,
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// 프론트엔드 빌드 파일 서빙 (dist 폴더)
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// 방별 인메모리 캐시 (DB와 병행 — 빠른 읽기용)
const roomIdeas: Record<string, IdeaInput[]> = {};
const roomUsers: Record<string, Map<string, string>> = {}; // userName -> color
const roomMessages: Record<string, any[]> = {};
const roomSections: Record<string, any[]> = {};
const roomAnalysisResults: Record<string, any[]> = {};
const roomCanvasImages: Record<string, any[]> = {};

// 헬스 체크
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SPA fallback — /socket.io 제외한 모든 경로에서 index.html 반환
app.get(/^(?!\/socket\.io).*$/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

io.on("connection", (socket) => {
  console.log(`클라이언트 연결: ${socket.id}`);
  let currentRoom = "";
  let currentUser = "";

  // 방 참가
  socket.on(
    "join-room",
    async ({ roomId, userName, userColor }: { roomId: string; userName: string; userColor?: string }) => {
      currentRoom = roomId;
      currentUser = userName;

      socket.join(roomId);

      if (!roomUsers[roomId]) {
        roomUsers[roomId] = new Map();
      }
      roomUsers[roomId].set(userName, userColor || "#E5E7EB");

      // DB에서 불러오기 (캐시가 비어있을 때만)
      if (!roomIdeas[roomId] || roomIdeas[roomId].length === 0) {
        try {
          const [ideas, sections, messages, analysisResults, canvasImages] = await Promise.all([
            dbGetIdeas(roomId),
            dbGetSections(roomId),
            dbGetMessages(roomId),
            dbGetAnalysisResults(roomId),
            dbGetCanvasImages(roomId),
          ]);
          roomIdeas[roomId] = ideas; // 이미지 포함 전체 보관 (속도 우선)
          roomSections[roomId] = sections;
          roomMessages[roomId] = messages;
          roomAnalysisResults[roomId] = analysisResults;
          roomCanvasImages[roomId] = canvasImages;
          if (ideas.length > 0 || sections.length > 0) {
            console.log(`DB에서 불러옴: 방 ${roomId} — 아이디어 ${ideas.length}개, 섹션 ${sections.length}개, 이미지 ${canvasImages.length}개`);
          }
        } catch (e) {
          console.error("DB 로드 실패 (메모리 모드 유지):", e);
          roomIdeas[roomId] = roomIdeas[roomId] || [];
          roomSections[roomId] = roomSections[roomId] || [];
          roomMessages[roomId] = roomMessages[roomId] || [];
          roomAnalysisResults[roomId] = roomAnalysisResults[roomId] || [];
          roomCanvasImages[roomId] = roomCanvasImages[roomId] || [];
        }
      }

      const usersArray = Array.from(roomUsers[roomId].entries()).map(([name, color]) => ({ name, color }));

      // 1단계: 이미지 content 제외하고 먼저 전송 (빠른 초기 렌더링)
      const ideasWithoutImages = (roomIdeas[roomId] || []).map((idea: any) => ({
        ...idea,
        attachments: idea.attachments?.map((a: any) => ({
          ...a,
          content: a.type === "image" ? "" : a.content,
        })) ?? [],
      }));
      socket.emit("room-state", {
        ideas: ideasWithoutImages,
        users: usersArray,
        messages: roomMessages[roomId] || [],
        sections: roomSections[roomId] || [],
        analysisResults: roomAnalysisResults[roomId] || [],
        canvasImages: roomCanvasImages[roomId] || [],
      });

      // 2단계: 이미지가 있는 카드만 이미지 포함해서 별도 전송 (백그라운드)
      const ideasWithImages = (roomIdeas[roomId] || []).filter((idea: any) =>
        idea.attachments?.some((a: any) => a.type === "image" && a.content)
      );
      if (ideasWithImages.length > 0) {
        setImmediate(() => {
          socket.emit("room-images-patch", { ideas: ideasWithImages });
        });
      }

      // 다른 유저들에게 알림
      socket.to(roomId).emit("user-joined", {
        userName,
        users: usersArray,
      });

      console.log(`${userName}이 방 ${roomId}에 참가했습니다.`);
    }
  );

  // 아이디어 추가
  socket.on("idea-added", async (idea: IdeaInput) => {
    if (!currentRoom) return;

    if (!roomIdeas[currentRoom]) {
      roomIdeas[currentRoom] = [];
    }

    // RAM에 이미지 포함 전체 저장 (속도 우선)
    roomIdeas[currentRoom].push(idea);

    dbUpsertIdea(currentRoom, idea).catch(e => console.error("idea upsert 실패:", e));

    // 발신자 제외하고 브로드캐스트 (발신자는 이미 낙관적 업데이트로 반영됨)
    socket.to(currentRoom).emit("idea-added", idea);
    console.log(`아이디어 추가: ${idea.title} (방: ${currentRoom})`);
  });

  // 아이디어 수정
  socket.on("idea-updated", async ({ ideaId, title, content, category, color, aiImageUrl, attachments }: { ideaId: string; title: string; content: string; category?: string; color?: string; aiImageUrl?: string; attachments?: any[] }) => {
    if (!currentRoom) return;
    if (roomIdeas[currentRoom]) {
      const idea = roomIdeas[currentRoom].find((i: any) => i.id === ideaId) as any;
      if (idea) {
        idea.title = title;
        idea.content = content;
        if (category) idea.category = category;
        if (color) idea.color = color;
        if (aiImageUrl !== undefined) idea.aiImageUrl = aiImageUrl;
        if (attachments !== undefined) idea.attachments = attachments;
      }
    }
    // DB 업데이트
    const patch: any = { title, content };
    if (category) patch.category = category;
    if (color) patch.color = color;
    if (aiImageUrl !== undefined) patch.aiImageUrl = aiImageUrl;
    if (attachments !== undefined) patch.attachments = attachments;
    dbUpdateIdea(currentRoom, ideaId, patch).catch(e => console.error("idea update 실패:", e));

    socket.to(currentRoom).emit("idea-updated", { ideaId, title, content, category, color, aiImageUrl, attachments });
  });

  // 카드 위치 이동 동기화 (드래그 완료 시)
  socket.on("idea-moved", async ({ ideaId, x, y }: { ideaId: string; x: number; y: number }) => {
    if (!currentRoom) return;
    // 메모리 업데이트
    if (roomIdeas[currentRoom]) {
      const idea = roomIdeas[currentRoom].find((i: any) => i.id === ideaId) as any;
      if (idea) { idea.x = x; idea.y = y; }
    }
    // DB 업데이트
    dbMoveIdea(currentRoom, ideaId, x, y).catch(e => console.error("idea move 실패:", e));
    socket.to(currentRoom).emit("idea-moved", { ideaId, x, y });
  });

  // 캔버스 이미지 추가
  socket.on("canvas-image-added", async (img: any) => {
    if (!currentRoom) return;
    if (!roomCanvasImages[currentRoom]) roomCanvasImages[currentRoom] = [];
    if (!roomCanvasImages[currentRoom].find((i: any) => i.id === img.id)) {
      roomCanvasImages[currentRoom].push(img);
    }
    dbUpsertCanvasImage(currentRoom, img).catch(e => console.error("canvas-image upsert 실패:", e));
    socket.to(currentRoom).emit("canvas-image-added", img);
  });

  // 캔버스 이미지 이동/리사이즈
  socket.on("canvas-image-updated", async (patch: any) => {
    if (!currentRoom) return;
    if (roomCanvasImages[currentRoom]) {
      const idx = roomCanvasImages[currentRoom].findIndex((i: any) => i.id === patch.id);
      if (idx !== -1) roomCanvasImages[currentRoom][idx] = { ...roomCanvasImages[currentRoom][idx], ...patch };
    }
    dbUpdateCanvasImage(currentRoom, patch.id, patch).catch(e => console.error("canvas-image update 실패:", e));
    socket.to(currentRoom).emit("canvas-image-updated", patch);
  });

  // 캔버스 이미지 삭제
  socket.on("canvas-image-deleted", async ({ id }: { id: string }) => {
    if (!currentRoom) return;
    if (roomCanvasImages[currentRoom]) {
      roomCanvasImages[currentRoom] = roomCanvasImages[currentRoom].filter((i: any) => i.id !== id);
    }
    dbDeleteCanvasImage(currentRoom, id).catch(e => console.error("canvas-image delete 실패:", e));
    socket.to(currentRoom).emit("canvas-image-deleted", { id });
  });

  // 카드 너비 변경
  socket.on("idea-resized", async ({ ideaId, width }: { ideaId: string; width: number }) => {
    if (!currentRoom) return;
    if (roomIdeas[currentRoom]) {
      const idea = roomIdeas[currentRoom].find((i: any) => i.id === ideaId) as any;
      if (idea) idea.width = width;
    }
    dbUpdateIdea(currentRoom, ideaId, { width }).catch(e => console.error("idea resize 저장 실패:", e));
    socket.to(currentRoom).emit("idea-resized", { ideaId, width });
  });

  // 섹션 동기화 + 서버 저장
  socket.on("section-added", async (section: any) => {
    if (!currentRoom) return;
    if (!roomSections[currentRoom]) roomSections[currentRoom] = [];
    if (!roomSections[currentRoom].find((s: any) => s.id === section.id)) {
      roomSections[currentRoom].push(section);
    }
    dbUpsertSection(currentRoom, section).catch(e => console.error("section upsert 실패:", e));
    socket.to(currentRoom).emit("section-added", section);
  });

  socket.on("section-updated", async (update: any) => {
    if (!currentRoom) return;
    if (roomSections[currentRoom]) {
      const idx = roomSections[currentRoom].findIndex((s: any) => s.id === update.id);
      if (idx !== -1) roomSections[currentRoom][idx] = { ...roomSections[currentRoom][idx], ...update };
    }
    dbUpdateSection(currentRoom, update).catch(e => console.error("section update 실패:", e));
    socket.to(currentRoom).emit("section-updated", update);
  });

  socket.on("section-deleted", async ({ id }: { id: string }) => {
    if (!currentRoom) return;
    if (roomSections[currentRoom]) {
      roomSections[currentRoom] = roomSections[currentRoom].filter((s: any) => s.id !== id);
    }
    dbDeleteSection(currentRoom, id).catch(e => console.error("section delete 실패:", e));
    socket.to(currentRoom).emit("section-deleted", { id });
  });

  // 아이디어 삭제
  socket.on("idea-deleted", async ({ ideaId }: { ideaId: string }) => {
    if (!currentRoom) return;

    if (roomIdeas[currentRoom]) {
      roomIdeas[currentRoom] = roomIdeas[currentRoom].filter(
        (idea) => idea.id !== ideaId
      );
    }
    dbDeleteIdea(currentRoom, ideaId).catch(e => console.error("idea delete 실패:", e));

    io.to(currentRoom).emit("idea-deleted", { ideaId });
    console.log(`아이디어 삭제: ${ideaId} (방: ${currentRoom})`);
  });

  // AI 분석 요청
  socket.on(
    "analysis-requested",
    async ({
      agentType,
      userMessage,
      files,
      categoryFilter,
      useSearch,
      ideaIds,
      topic,
      excludeIds,
      filesOnly,
      sectionGroups,
    }: {
      agentType: string | null;
      userMessage?: string;
      files?: AnalysisFile[];
      categoryFilter?: string | null;
      useSearch?: boolean;
      ideaIds?: string[];
      topic?: string;
      excludeIds?: string[];
      filesOnly?: boolean;
      sectionGroups?: { title: string; ideaIds: string[] }[];
    }) => {
      if (!currentRoom) return;

      // filesOnly 모드: 보드 아이디어 무시, 파일만으로 분석
      let ideas: any[] = [];
      if (!filesOnly) {
        const allIdeas = roomIdeas[currentRoom] || [];
        ideas = (ideaIds
          ? allIdeas.filter((i: any) => ideaIds.includes(i.id))
          : categoryFilter
            ? allIdeas.filter((i: any) => (i.category ?? "brainstorm") === categoryFilter)
            : allIdeas
        ).filter((i: any) => !i.analysisSnapshot && !(excludeIds ?? []).includes(i.id));

        // 섹션 그룹이 지정된 경우, 해당 섹션에 속한 아이디어만 사용
        if (sectionGroups && sectionGroups.length > 0) {
          const sectionIdeaIds = new Set(sectionGroups.flatMap((g: any) => g.ideaIds));
          ideas = ideas.filter((i: any) => sectionIdeaIds.has(i.id));
        }
      }

      // filesOnly인데 파일도 없으면 오류
      if (filesOnly && (!files || files.length === 0)) {
        socket.emit("analysis-error", { message: "분석할 파일이 없습니다. 아이디어 파일을 첨부해주세요." });
        return;
      }
      if (!filesOnly && ideas.length === 0) {
        const msg = ideaIds
          ? "선택된 섹션에 분석할 아이디어가 없습니다."
          : categoryFilter
            ? `'${categoryFilter}' 카테고리에 분석할 아이디어가 없습니다.`
            : "분석할 아이디어가 없습니다. 먼저 아이디어를 추가해주세요.";
        socket.emit("analysis-error", { message: msg });
        return;
      }

      // 분석 시작 알림
      io.to(currentRoom).emit("analysis-started", { requester: currentUser, agentType });

      try {
        const result = await analyzeIdeas(
          ideas,
          agentType as any,
          userMessage || "",
          files || [],
          useSearch || false,
          filesOnly ? undefined : sectionGroups  // 파일 기반 분석 시 보드 섹션 제외
        );

        const timestamp = new Date().toISOString();
        const resultAny = result as any;
        const historyItem = {
          id: `${Date.now()}-${Math.random()}`,
          agentType,
          requester: currentUser,
          timestamp,
          result: resultAny.agentType ? null : result,
          agentResult: resultAny.agentType ? result : null,
        };

        // DB에 저장 후 dbId 첨부
        const dbId = await dbInsertAnalysisResult(currentRoom, historyItem).catch(e => {
          console.error("분석 결과 저장 실패:", e);
          return null; // null이면 프론트에서 삭제 버튼 비노출
        });
        if (!roomAnalysisResults[currentRoom]) roomAnalysisResults[currentRoom] = [];
        roomAnalysisResults[currentRoom].unshift({ dbId, ...historyItem });

        io.to(currentRoom).emit("analysis-result", {
          ...result,
          _meta: { requester: currentUser, agentType, timestamp, dbId },
        });
        console.log(`분석 완료 (방: ${currentRoom})`);

      } catch (error) {
        let errorMessage = "알 수 없는 오류가 발생했습니다.";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "object" && error !== null) {
          errorMessage = JSON.stringify(error);
        }
        console.error(`분석 오류 (방: ${currentRoom}):`, error);
        io.to(currentRoom).emit("analysis-error", { message: errorMessage });
      }
    }
  );

  // 사용자 채팅 메시지
  socket.on(
    "user-message",
    async ({
      message,
      agentType,
      contextIdea,
    }: {
      message: string;
      agentType: string | null;
      contextIdea?: { title: string; content: string } | null;
    }) => {
      if (!currentRoom) return;

      const ideas = roomIdeas[currentRoom] || [];

      // 메시지 브로드캐스트
      io.to(currentRoom).emit("user-message", {
        userName: currentUser,
        message,
        timestamp: new Date().toISOString(),
      });

      try {
        const aiResponse = await chatWithAI(message, ideas, agentType as any, contextIdea ?? null);
        io.to(currentRoom).emit("ai-response", {
          message: aiResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "AI 응답 중 오류가 발생했습니다.";
        socket.emit("ai-response", {
          message: `오류: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          isError: true,
        });
      }
    }
  );

  // 주제 변경 (보드 상단 주제 공유)
  socket.on("topic-changed", ({ topic }: { topic: string }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("topic-changed", { topic });
  });

  // 순수 채팅 메시지 (AI 응답 없이 방 전체 브로드캐스트)
  socket.on(
    "chat-message",
    async ({ message, imageUrl, userColor }: { message: string; imageUrl?: string; userColor?: string }) => {
      if (!currentRoom) return;
      const chatMsg = {
        userName: currentUser,
        message,
        imageUrl,
        userColor,
        timestamp: new Date().toISOString(),
      };
      if (!roomMessages[currentRoom]) {
        roomMessages[currentRoom] = [];
      }
      roomMessages[currentRoom].push(chatMsg);
      dbInsertMessage(currentRoom, chatMsg).catch(e => console.error("message insert 실패:", e));
      io.to(currentRoom).emit("chat-message", chatMsg);
    }
  );

  // 코멘트 추가
  socket.on("comment-added", ({ ideaId, comment }: { ideaId: string; comment: any }) => {
    if (!currentRoom) return;
    if (roomIdeas[currentRoom]) {
      const idea = roomIdeas[currentRoom].find((i: any) => i.id === ideaId) as any;
      if (idea) {
        if (!idea.comments) idea.comments = [];
        idea.comments.push(comment);
      }
    }
    // 코멘트가 포함된 전체 아이디어를 DB에 저장
    const idea = roomIdeas[currentRoom]?.find((i: any) => i.id === ideaId);
    if (idea) dbUpsertIdea(currentRoom, idea).catch(e => console.error("comment save 실패:", e));
    socket.broadcast.to(currentRoom).emit("comment-added", { ideaId, comment });
  });

  // 아이디어 재동기화 (백엔드 재시작 후 프론트엔드에서 전송)
  socket.on("ideas-sync", async (syncedIdeas: IdeaInput[]) => {
    if (!currentRoom) return;
    if (!roomIdeas[currentRoom] || roomIdeas[currentRoom].length === 0) {
      roomIdeas[currentRoom] = syncedIdeas;
      // DB에도 저장
      for (const idea of syncedIdeas) {
        dbUpsertIdea(currentRoom, idea).catch(e => console.error("sync upsert 실패:", e));
      }
    }
  });

  // 채팅 전체 삭제
  socket.on("chat-messages-clear", async () => {
    if (!currentRoom) return;
    roomMessages[currentRoom] = [];
    dbClearMessages(currentRoom).catch(e => console.error("chat clear 실패:", e));
    io.to(currentRoom).emit("chat-messages-cleared");
  });

  // 분석 결과 수정 (이미지 업로드 등) — 다른 팀원에게 브로드캐스트
  socket.on("analysis-result-update", async ({ id, agentResult }: { id: string; agentResult: any }) => {
    if (!currentRoom) return;
    // RAM 업데이트
    if (roomAnalysisResults[currentRoom]) {
      const item = roomAnalysisResults[currentRoom].find((r: any) => r.id === id);
      if (item) item.agentResult = agentResult;
    }
    // DB 업데이트 (비동기)
    dbUpdateAnalysisResult(currentRoom, id, agentResult).catch(e => console.error("분석 결과 업데이트 실패:", e));
    // 발신자 제외하고 다른 팀원에게 브로드캐스트
    socket.to(currentRoom).emit("analysis-result-updated", { id, agentResult });
  });

  // 분석 내역 삭제
  socket.on("analysis-result-delete", async ({ dbId }: { dbId: number }) => {
    if (!currentRoom) return;
    if (roomAnalysisResults[currentRoom]) {
      roomAnalysisResults[currentRoom] = roomAnalysisResults[currentRoom].filter((r: any) => r.dbId !== dbId);
    }
    dbDeleteAnalysisResult(currentRoom, dbId).catch(e => console.error("분석 내역 삭제 실패:", e));
    io.to(currentRoom).emit("analysis-result-deleted", { dbId });
  });

  // 연결 해제
  socket.on("disconnect", () => {
    if (currentRoom && roomUsers[currentRoom]) {
      roomUsers[currentRoom].delete(currentUser);
      const usersArray = Array.from(roomUsers[currentRoom].entries()).map(([name, color]) => ({ name, color }));
      socket.to(currentRoom).emit("user-left", {
        userName: currentUser,
        users: usersArray,
      });
    }
    console.log(`클라이언트 연결 해제: ${socket.id} (${currentUser})`);
  });
});

const PORT = process.env.PORT || 3001;

// DB 초기화 후 서버 시작
initDb().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
    console.log(`   헬스 체크: http://localhost:${PORT}/health`);
    console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "✓ 설정됨" : "✗ 미설정"}`);
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✓ 설정됨 (길이: " + process.env.GEMINI_API_KEY.length + ")" : "✗ 미설정"}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✓ DB 연결됨" : "✗ 없음 (메모리 모드)"}\n`);
  });
}).catch(e => {
  console.error("DB 초기화 실패:", e);
  process.exit(1);
});
