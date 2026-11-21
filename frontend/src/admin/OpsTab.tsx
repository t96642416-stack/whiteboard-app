import React, { useCallback, useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { getJson, sendJson, download, roomPath } from "./api";
import { fmtBytes, fmtAgo, fmtTime } from "./format";

interface Room {
  roomId: string; ideas: number; sections: number; messages: number; analyses: number; images: number;
  events: number | null; bytes: number | null; lastActivity: string | null; liveUsers: number;
  title: string | null; status: "open" | "closed" | "unregistered"; createdAt: string | null; closedAt: string | null;
}
interface Overview {
  db: boolean;
  storage: { databaseBytes: number; limitBytes: number; tables: { name: string; bytes: number }[] } | null;
  live: { roomId: string; userName: string; joinedAt: string }[];
  rooms: Room[];
  serverTime: string;
}

const Card: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
    <div className="flex items-center mb-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="ml-auto">{right}</div>
    </div>
    {children}
  </section>
);

const OpsTab: React.FC<{ onError: (e: unknown) => void; onOpenResearch: (roomId: string) => void }> = ({ onError, onOpenResearch }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState<{ roomId: string; title: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await getJson<Overview>("/overview")); setErr(null); }
    catch (e: any) { onError(e); setErr(e.message); }
  }, [onError]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 4000); };

  if (!data) return <p className="text-sm text-gray-500">{err ?? "불러오는 중…"}</p>;

  const used = data.storage?.databaseBytes ?? 0;
  const limit = data.storage?.limitBytes ?? 1;
  const ratio = Math.min(1, used / limit);
  const level = ratio >= 0.9 ? "critical" : ratio >= 0.75 ? "warning" : "good";
  const levelStyle = { good: ["#0a7f3f", "여유"], warning: ["#b25e00", "주의"], critical: ["#c62828", "위험"] }[level];

  const liveByRoom = data.live.reduce<Record<string, typeof data.live>>((acc, s) => { (acc[s.roomId] ??= []).push(s); return acc; }, {});

  return (
    <div className="space-y-4">
      {notice && <div className="rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5">{notice}</div>}
      {err && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2.5">갱신 실패: {err}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="DB 용량">
          {data.storage ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{fmtBytes(used)}</span>
                <span className="text-sm text-gray-500">/ {fmtBytes(limit)}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: levelStyle[0] }}>
                  <span aria-hidden>{level === "good" ? "●" : "▲"}</span>{levelStyle[1]}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden" role="meter" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: levelStyle[0] }} />
              </div>
              <ul className="mt-3 space-y-1 text-xs text-gray-500">
                {data.storage.tables.slice(0, 4).map((t) => (
                  <li key={t.name} className="flex"><span>{t.name}</span><span className="ml-auto tabular-nums">{fmtBytes(t.bytes)}</span></li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-gray-400">볼륨 전체 용량은 DB 파일 외 로그 등을 포함해 이보다 조금 큽니다.</p>
            </>
          ) : <p className="text-sm text-gray-500">DB 미연결 (메모리 모드)</p>}
        </Card>

        <Card title="지금 접속 중" right={<span className="text-xs text-gray-400">10초마다 갱신</span>}>
          <div className="text-2xl font-bold tabular-nums">{data.live.length}<span className="text-sm font-normal text-gray-500 ml-1">명</span></div>
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
            {Object.keys(liveByRoom).length === 0 && <p className="text-sm text-gray-400">접속자가 없습니다</p>}
            {Object.entries(liveByRoom).map(([roomId, list]) => (
              <div key={roomId}>
                <div className="text-xs font-semibold text-gray-600">{roomId}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {list.map((s, i) => (
                    <span key={i} className="text-xs bg-gray-100 rounded px-1.5 py-0.5" title={`접속: ${fmtTime(s.joinedAt)}`}>
                      {s.userName} <span className="text-gray-400">{fmtAgo(s.joinedAt)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <RestoreCard onDone={(msg) => { flash(msg); load(); }} onError={onError} disabled={!data.db} />
      </div>

      <Card title={`방 목록 (${data.rooms.length})`}
        right={<button onClick={() => setCreating(true)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">+ 방 만들기</button>}>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 px-4 sm:pl-0 font-medium">방</th>
                <th className="py-2 font-medium">상태</th>
                <th className="py-2 font-medium text-right">아이디어</th>
                <th className="py-2 font-medium text-right">섹션</th>
                <th className="py-2 font-medium text-right">채팅</th>
                <th className="py-2 font-medium text-right">분석</th>
                <th className="py-2 font-medium text-right">이미지</th>
                <th className="py-2 font-medium text-right">로그</th>
                <th className="py-2 font-medium text-right">용량</th>
                <th className="py-2 font-medium pl-4">마지막 기록</th>
                <th className="py-2 font-medium text-right pr-4 sm:pr-0">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={r.roomId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-4 sm:pl-0">
                    <div className="font-medium">{r.title || r.roomId}</div>
                    {r.title && <div className="text-xs text-gray-400">{r.roomId}</div>}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {r.status === "open" && <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">● 진행 중{r.liveUsers > 0 ? ` · ${r.liveUsers}명` : ""}</span>}
                    {r.status === "closed" && <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5" title={fmtTime(r.closedAt)}>■ 마감</span>}
                    {r.status === "unregistered" && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5" title="관리자가 만들지 않은 방이라 입장할 수 없습니다">미등록</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.ideas}</td>
                  <td className="py-2 text-right tabular-nums">{r.sections}</td>
                  <td className="py-2 text-right tabular-nums">{r.messages}</td>
                  <td className="py-2 text-right tabular-nums">{r.analyses}</td>
                  <td className="py-2 text-right tabular-nums">{r.images}</td>
                  <td className="py-2 text-right tabular-nums">{r.events ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums">{fmtBytes(r.bytes)}</td>
                  <td className="py-2 pl-4 text-gray-500" title={fmtTime(r.lastActivity)}>{fmtAgo(r.lastActivity)}</td>
                  <td className="py-2 pr-4 sm:pr-0 text-right whitespace-nowrap">
                    {r.status === "open" && (
                      <button onClick={() => setInviting({ roomId: r.roomId, title: r.title })} className="text-xs px-2 py-1 rounded hover:bg-indigo-50 text-indigo-600 font-semibold">초대</button>
                    )}
                    {r.status === "open" && (
                      <button onClick={async () => {
                        if (!window.confirm(`'${r.title || r.roomId}' 방을 마감할까요?\n접속 중인 참가자${r.liveUsers ? ` ${r.liveUsers}명` : ""}의 화면에 종료 안내가 뜨고, 이후 입장할 수 없습니다.`)) return;
                        try { await sendJson("POST", `${roomPath(r.roomId)}/close`, {}); flash(`'${r.title || r.roomId}' 방을 마감했습니다.`); load(); }
                        catch (e: any) { onError(e); flash(e.message); }
                      }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-700">마감</button>
                    )}
                    {r.status === "closed" && (
                      <button onClick={async () => {
                        try { await sendJson("POST", `${roomPath(r.roomId)}/reopen`, {}); flash(`'${r.title || r.roomId}' 방을 다시 열었습니다.`); load(); }
                        catch (e: any) { onError(e); flash(e.message); }
                      }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-700">다시 열기</button>
                    )}
                    <button onClick={() => onOpenResearch(r.roomId)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-700">지표</button>
                    <button onClick={() => download(`${roomPath(r.roomId)}/backup`).catch((e) => { onError(e); flash(e.message); })}
                      className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-700">백업</button>
                    <button onClick={() => setDeleting(r)} disabled={r.liveUsers > 0}
                      title={r.liveUsers > 0 ? "접속자가 있는 방은 삭제할 수 없습니다" : ""}
                      className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">"마지막 기록"은 마지막으로 새 항목이 저장된 시각입니다. 카드 수정·이동은 행동 로그(이번 업데이트부터 기록)에 반영됩니다.</p>
      </Card>

      {creating && (
        <CreateRoomDialog existing={data.rooms.map((r) => r.roomId)} onClose={() => setCreating(false)} onError={onError}
          onDone={(room) => { setCreating(false); load(); setInviting(room); }} />
      )}
      {inviting && <InviteDialog room={inviting} onClose={() => setInviting(null)} />}

      {deleting && (
        <DeleteDialog room={deleting} onClose={() => setDeleting(null)}
          onDone={() => { setDeleting(null); flash(`'${deleting.roomId}' 방을 삭제했습니다.`); load(); }} onError={onError} />
      )}
    </div>
  );
};

function suggestRoomId(existing: string[]): string {
  const d = new Date();
  const prefix = `exp-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
  let n = 1;
  while (existing.includes(prefix + n)) n++;
  return prefix + n;
}

const CreateRoomDialog: React.FC<{ existing: string[]; onClose: () => void; onDone: (room: { roomId: string; title: string | null }) => void; onError: (e: unknown) => void }> = ({ existing, onClose, onDone, onError }) => {
  const [roomId, setRoomId] = useState(() => suggestRoomId(existing));
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = /^[A-Za-z0-9가-힣_-]{1,40}$/.test(roomId.trim());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      const room = await sendJson<{ roomId: string; title: string | null }>("POST", "/rooms", { roomId: roomId.trim(), title: title.trim() });
      onDone(room);
    } catch (e: any) { onError(e); setErr(e.message); } finally { setBusy(false); }
  };
  const field = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">방 만들기</h3>
        <label className="block text-xs text-gray-500">방 코드 (링크에 들어감, 영문·숫자·한글·-·_)
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} autoFocus className={field + " mt-1 font-mono"} />
        </label>
        <label className="block text-xs text-gray-500">방 이름 (선택, 참가자 입장 화면에 표시)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1조 – 환경 아이디어 (AI 사용)" maxLength={60} className={field + " mt-1"} />
        </label>
        {!valid && roomId && <p className="text-sm text-red-600">방 코드는 영문·숫자·한글·-·_ 로 1~40자여야 합니다.</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-gray-100">취소</button>
          <button disabled={!valid || busy} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400">
            {busy ? "만드는 중…" : "만들고 초대 링크 받기"}
          </button>
        </div>
      </form>
    </div>
  );
};

const InviteDialog: React.FC<{ room: { roomId: string; title: string | null }; onClose: () => void }> = ({ room, onClose }) => {
  const url = `${window.location.origin}/?room=${encodeURIComponent(room.roomId)}`;
  const [copied, setCopied] = useState(false);
  const local = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
  const svg = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(unescape(encodeURIComponent(url))); // 한글 방 코드도 UTF-8로
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* 무시 */ }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-3 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">참가자 초대</h3>
        <p className="text-sm text-gray-600">{room.title || room.roomId}</p>
        <div className="mx-auto w-56 h-56 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-xs text-gray-500">참가자가 QR을 찍거나 링크를 열면 방이 정해진 입장 화면이 나옵니다. 참여 코드만 입력하면 됩니다.</p>
        <div className="flex gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-gray-50" />
          <button onClick={copy} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold shrink-0">{copied ? "복사됨" : "복사"}</button>
        </div>
        {local && <p className="text-xs text-amber-700">지금은 localhost 주소라 다른 기기에서 열 수 없습니다. 배포된 사이트의 관리자 화면에서 초대하세요.</p>}
        <button onClick={onClose} className="w-full py-2 text-sm rounded-lg hover:bg-gray-100">닫기</button>
      </div>
    </div>
  );
};

const DeleteDialog: React.FC<{ room: Room; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }> = ({ room, onClose, onDone, onError }) => {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await sendJson("DELETE", roomPath(room.roomId), { confirm: typed }); onDone(); }
    catch (e: any) { onError(e); setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">방 삭제: {room.roomId}</h3>
        <p className="text-sm text-gray-600">
          아이디어 {room.ideas}개, 섹션 {room.sections}개, 채팅 {room.messages}개, 분석 {room.analyses}개, 이미지 {room.images}개와
          행동 로그가 <b>영구 삭제</b>됩니다. 먼저 <b>백업</b>을 받아두는 것을 권장합니다.
        </p>
        <p className="text-sm text-gray-600">확인을 위해 방 ID <code className="bg-gray-100 px-1 rounded">{room.roomId}</code>를 입력하세요.</p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-gray-100">취소</button>
          <button onClick={submit} disabled={typed !== room.roomId || busy}
            className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400">
            {busy ? "삭제 중…" : "영구 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RestoreCard: React.FC<{ onDone: (msg: string) => void; onError: (e: unknown) => void; disabled: boolean }> = ({ onDone, onError, disabled }) => {
  const [file, setFile] = useState<File | null>(null);
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | null) => {
    setFile(f); setErr(null);
    if (!f) return;
    try {
      const head = JSON.parse(await f.text());
      if (head.format !== "whiteboard-backup") { setErr("백업 파일 형식이 아닙니다."); return; }
      if (!roomId) setRoomId(`${head.roomId}-restored`);
    } catch { setErr("JSON 파일을 읽을 수 없습니다."); }
  };

  const submit = async () => {
    if (!file || !roomId.trim()) return;
    setBusy(true); setErr(null);
    try {
      const body = JSON.parse(await file.text());
      await sendJson("POST", `${roomPath(roomId.trim())}/restore`, body);
      onDone(`'${roomId.trim()}' 방으로 복원했습니다.`);
      setFile(null); setRoomId(""); if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) { onError(e); setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card title="백업 복원">
      {disabled ? <p className="text-sm text-gray-500">DB가 연결되어 있을 때만 복원할 수 있습니다.</p> : (
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-600 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700" />
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="복원할 방 ID (비어 있는 방)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={submit} disabled={!file || !roomId.trim() || busy}
            className="w-full py-2 text-sm rounded-lg bg-gray-900 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400">
            {busy ? "복원 중…" : "복원"}
          </button>
          <p className="text-[11px] text-gray-400">기존 데이터를 덮어쓰지 않도록 비어 있는 방에만 복원됩니다.</p>
        </div>
      )}
    </Card>
  );
};

export default OpsTab;
