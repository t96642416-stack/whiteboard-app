import React, { useCallback, useState } from "react";
import { getToken, setToken, login, AuthError } from "./api";
import OpsTab from "./OpsTab";
import ResearchTab from "./ResearchTab";

type Tab = "ops" | "research";

const LoginForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(pw); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">화이트보드 관리자</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 비밀번호를 입력하세요</p>
        </div>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={!pw || busy}
          className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300">
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
};

const AdminApp: React.FC = () => {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState<Tab>("ops");
  const [researchRoom, setResearchRoom] = useState<string | null>(null);

  // 하위 탭에서 인증 오류가 나면 로그인 화면으로
  const onError = useCallback((e: unknown) => { if (e instanceof AuthError) setAuthed(false); }, []);

  if (!authed) return <LoginForm onDone={() => setAuthed(true)} />;

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <h1 className="font-bold text-sm sm:text-base">화이트보드 관리자</h1>
          <nav className="flex gap-1 ml-2">
            {([["ops", "운영"], ["research", "연구 지표"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-800">보드로</a>
            <button onClick={() => { setToken(null); setAuthed(false); }}
              className="text-sm text-gray-500 hover:text-gray-800">로그아웃</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "ops"
          ? <OpsTab onError={onError} onOpenResearch={(roomId) => { setResearchRoom(roomId); setTab("research"); }} />
          : <ResearchTab onError={onError} initialRoom={researchRoom} />}
      </main>
    </div>
  );
};

export default AdminApp;
