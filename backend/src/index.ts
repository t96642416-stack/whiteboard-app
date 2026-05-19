import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { analyzeIdeas, chatWithAI, IdeaInput } from "./claude";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 모든 origin 허용 (ngrok/터널 환경 대응)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// 프론트엔드 빌드 파일 서빙 (dist 폴더)
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// 방별 아이디어 저장
const roomIdeas: Record<string, IdeaInput[]> = {};
const roomUsers: Record<string, Map<string, string>> = {}; // userName -> color

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
    ({ roomId, userName, userColor }: { roomId: string; userName: string; userColor?: string }) => {
      currentRoom = roomId;
      currentUser = userName;

      socket.join(roomId);

      if (!roomIdeas[roomId]) {
        roomIdeas[roomId] = [];
      }
      if (!roomUsers[roomId]) {
        roomUsers[roomId] = new Map();
      }
      roomUsers[roomId].set(userName, userColor || "#E5E7EB");

      const usersArray = Array.from(roomUsers[roomId].entries()).map(([name, color]) => ({ name, color }));

      // 현재 방의 아이디어 전송
      socket.emit("room-state", {
        ideas: roomIdeas[roomId],
        users: usersArray,
      });

      // 다른 유저들에게 알림
      socket.to(roomId).emit("user-joined", {
        userName,
        users: usersArray,
      });

      console.log(`${userName}이 방 ${roomId}에 참가했습니다.`);
    }
  );

  // 아이디어 추가
  socket.on("idea-added", (idea: IdeaInput) => {
    if (!currentRoom) return;

    if (!roomIdeas[currentRoom]) {
      roomIdeas[currentRoom] = [];
    }

    roomIdeas[currentRoom].push(idea);

    // 같은 방의 모든 유저에게 브로드캐스트
    io.to(currentRoom).emit("idea-added", idea);
    console.log(`아이디어 추가: ${idea.title} (방: ${currentRoom})`);
  });

  // 아이디어 삭제
  socket.on("idea-deleted", ({ ideaId }: { ideaId: string }) => {
    if (!currentRoom) return;

    if (roomIdeas[currentRoom]) {
      roomIdeas[currentRoom] = roomIdeas[currentRoom].filter(
        (idea) => idea.id !== ideaId
      );
    }

    io.to(currentRoom).emit("idea-deleted", { ideaId });
    console.log(`아이디어 삭제: ${ideaId} (방: ${currentRoom})`);
  });

  // AI 분석 요청
  socket.on(
    "analysis-requested",
    async ({
      agentType,
      userMessage,
    }: {
      agentType: string | null;
      userMessage?: string;
    }) => {
      if (!currentRoom) return;

      const ideas = roomIdeas[currentRoom] || [];

      if (ideas.length === 0) {
        socket.emit("analysis-error", {
          message: "분석할 아이디어가 없습니다. 먼저 아이디어를 추가해주세요.",
        });
        return;
      }

      // 분석 시작 알림
      io.to(currentRoom).emit("analysis-started");

      try {
        const result = await analyzeIdeas(
          ideas,
          agentType as any,
          userMessage || ""
        );
        io.to(currentRoom).emit("analysis-result", result);
        console.log(`분석 완료 (방: ${currentRoom})`);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.";
        io.to(currentRoom).emit("analysis-error", { message: errorMessage });
        console.error(`분석 오류 (방: ${currentRoom}):`, error);
      }
    }
  );

  // 사용자 채팅 메시지
  socket.on(
    "user-message",
    async ({
      message,
      agentType,
    }: {
      message: string;
      agentType: string | null;
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
        const aiResponse = await chatWithAI(message, ideas, agentType as any);
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
    ({ message, imageUrl, userColor }: { message: string; imageUrl?: string; userColor?: string }) => {
      if (!currentRoom) return;
      io.to(currentRoom).emit("chat-message", {
        userName: currentUser,
        message,
        imageUrl,
        userColor,
        timestamp: new Date().toISOString(),
      });
    }
  );

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
httpServer.listen(PORT, () => {
  console.log(`\n🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
  console.log(`   헬스 체크: http://localhost:${PORT}/health`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "✓ 설정됨" : "✗ 미설정"}\n`);
});
