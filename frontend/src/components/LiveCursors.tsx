import React, { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

// 피그마처럼 다른 참가자의 마우스 커서를 이름표와 함께 표시
// 좌표는 캔버스(월드) 좌표로 주고받아서 각자 줌/스크롤이 달라도 같은 지점을 가리킴

const CURSOR_COLORS = [
  "#F24E1E", "#FF7262", "#A259FF", "#1ABCFE", "#0ACF83",
  "#FF8A00", "#E91E63", "#3F51B5", "#009688", "#795548",
];

export function cursorColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length];
}

interface RemoteCursor {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface Props {
  canvasRef: React.RefObject<HTMLDivElement>;
  offset: { x: number; y: number };
  zoom: number;
}

const SEND_INTERVAL_MS = 30;

const LiveCursors: React.FC<Props> = ({ canvasRef, offset, zoom }) => {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const viewRef = useRef({ offset, zoom });
  viewRef.current = { offset, zoom };

  // 내 커서 전송
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const socket = getSocket();
    let lastSent = 0;
    let pending: { x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (!pending) return;
      socket.emit("cursor-move", pending);
      pending = null;
      lastSent = Date.now();
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const { offset: o, zoom: z } = viewRef.current;
      pending = {
        x: Math.round((e.clientX - rect.left - o.x) / z),
        y: Math.round((e.clientY - rect.top - o.y) / z),
      };
      const wait = SEND_INTERVAL_MS - (Date.now() - lastSent);
      if (wait <= 0) flush();
      else if (!timer) timer = setTimeout(flush, wait);
    };

    const onLeave = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      pending = null;
      socket.emit("cursor-leave");
    };

    el.addEventListener("pointermove", onMove, { capture: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove, { capture: true });
      el.removeEventListener("pointerleave", onLeave);
      if (timer) clearTimeout(timer);
    };
  }, [canvasRef]);

  // 다른 사람 커서 수신
  useEffect(() => {
    const socket = getSocket();
    const onCursorMove = (c: RemoteCursor) => {
      setCursors(prev => ({ ...prev, [c.id]: c }));
    };
    const onCursorLeave = ({ id }: { id: string }) => {
      setCursors(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
    const onDisconnect = () => setCursors({});
    socket.on("cursor-move", onCursorMove);
    socket.on("cursor-leave", onCursorLeave);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("cursor-move", onCursorMove);
      socket.off("cursor-leave", onCursorLeave);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 40 }}>
      {Object.values(cursors).map(c => {
        const color = cursorColorFor(c.name);
        const sx = c.x * zoom + offset.x;
        const sy = c.y * zoom + offset.y;
        return (
          <div
            key={c.id}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${sx}px, ${sy}px)`,
              transition: "transform 80ms linear",
              willChange: "transform",
            }}
          >
            <svg width="20" height="22" viewBox="0 0 20 22" style={{ display: "block", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.3))" }}>
              <path d="M2 1.5 L2 18 L6.5 13.8 L9.6 20.6 L12.6 19.3 L9.6 12.6 L16 12.4 Z"
                fill={color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div
              className="absolute whitespace-nowrap text-white text-xs font-semibold px-2 py-0.5 rounded-md shadow-sm"
              style={{ left: 14, top: 18, backgroundColor: color }}
            >
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LiveCursors;
