// 관리자 API 호출 (토큰은 탭을 닫으면 사라지도록 sessionStorage에 보관)

const BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001/api/admin"
    : "/api/admin";

const KEY = "wb-admin-token";

export function getToken(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
}

export class AuthError extends Error {}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && path !== "/login") { setToken(null); throw new AuthError("로그인이 만료되었습니다."); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }
  return res;
}

export async function login(password: string): Promise<void> {
  const res = await request("/login", { method: "POST", body: JSON.stringify({ password }) });
  const { token } = await res.json();
  setToken(token);
}

export const getJson = async <T,>(path: string): Promise<T> => (await request(path)).json();

export async function sendJson<T = any>(method: "POST" | "DELETE", path: string, body: unknown): Promise<T> {
  return (await request(path, { method, body: JSON.stringify(body) })).json();
}

/** 인증이 필요한 파일을 받아서 브라우저 다운로드로 저장 */
export async function download(path: string): Promise<void> {
  const res = await request(path);
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : "download";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const roomPath = (roomId: string) => `/rooms/${encodeURIComponent(roomId)}`;

export async function changePassword(current: string, next: string): Promise<void> {
  const { token } = await sendJson<{ token: string }>("POST", "/password", { current, next });
  setToken(token);
}
