import { io, Socket } from "socket.io-client";

// 터널/배포 환경에서는 현재 페이지 origin을 백엔드로 사용
const BACKEND_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("소켓 연결됨:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("소켓 연결 해제:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("소켓 연결 오류:", error.message);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
