import React, { useCallback, useEffect, useState } from "react";
import { getToken, setToken, login, AuthError, changePassword, getJson } from "./api";
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

const PasswordDialog: React.FC<{ onClose: () => void; onDone: () => void; onError: (e: unknown) => void }> = ({ onClose, onDone, onError }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const problem =
    next && next.length < 8 ? "새 비밀번호는 8자 이상이어야 합니다." :
    confirm && next !== confirm ? "새 비밀번호가 서로 다릅니다." : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || !current || !next || next !== confirm) return;
    setBusy(true); setErr(null);
    try { await changePassword(current, next); onDone(); }
    catch (e: any) { if (e instanceof AuthError) onError(e); setErr(e.message); }
    finally { setBusy(false); }
  };
  const field = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">관리자 비밀번호 변경</h3>
        <label className="block text-xs text-gray-500">현재 비밀번호
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus autoComplete="current-password" className={field + " mt-1"} />
        </label>
        <label className="block text-xs text-gray-500">새 비밀번호 (8자 이상)
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={field + " mt-1"} />
        </label>
        <label className="block text-xs text-gray-500">새 비밀번호 확인
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={field + " mt-1"} />
        </label>
        {(problem || err) && <p className="text-sm text-red-600">{problem || err}</p>}
        <p className="text-[11px] text-gray-400">변경하면 다른 기기의 관리자 로그인은 모두 풀립니다.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-gray-100">취소</button>
          <button disabled={!!problem || !current || !next || next !== confirm || busy}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400">
            {busy ? "변경 중…" : "변경"}
          </button>
        </div>
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
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSource, setPwSource] = useState<"env" | "changed" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    getJson<{ passwordSource: "env" | "changed" }>("/me").then((r) => setPwSource(r.passwordSource)).catch(onError);
  }, [authed, onError]);

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
            <button onClick={() => setPwOpen(true)} className="text-sm text-gray-500 hover:text-gray-800">비밀번호 변경</button>
            <button onClick={() => { setToken(null); setAuthed(false); }}
              className="text-sm text-gray-500 hover:text-gray-800">로그아웃</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {notice && <div className="mb-4 rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5">{notice}</div>}
        {pwSource === "env" && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-2.5 flex items-center gap-3">
            <span>초기 비밀번호를 사용 중입니다. 본인만 아는 비밀번호로 바꾸는 것을 권장합니다.</span>
            <button onClick={() => setPwOpen(true)} className="ml-auto shrink-0 font-semibold underline underline-offset-2">지금 변경</button>
          </div>
        )}
        {tab === "ops"
          ? <OpsTab onError={onError} onOpenResearch={(roomId) => { setResearchRoom(roomId); setTab("research"); }} />
          : <ResearchTab onError={onError} initialRoom={researchRoom} />}
      </main>
      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} onError={onError}
        onDone={() => { setPwOpen(false); setPwSource("changed"); setNotice("비밀번호를 변경했습니다."); setTimeout(() => setNotice(null), 4000); }} />}
    </div>
  );
};

export default AdminApp;
