import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getJson, sendJson, download, roomPath } from "./api";
import { agentLabel, fmtPct, fmtTime, CATEGORY_LABELS } from "./format";

// 차트 색 (검증된 기본 팔레트 1·2번: 인접 쌍 색각이상 구분 통과)
const C_HUMAN = "#2a78d6";
const C_AI = "#eb6834";

interface Metrics {
  summary: {
    participants: number; totalIdeas: number; humanIdeas: number; aiCards: number; aiShare: number;
    avgIdeaLength: number; attachments: number; comments: number; crossCommentShare: number; chats: number;
    analyses: number; analysisErrors: number; giniHumanIdeas: number; categoryCounts: Record<string, number>;
    sections: number; start: string | null; end: string | null; durationMin: number; humanIdeasPerMin: number;
    editedIdeas: number; deletedIdeas: number; eventCount: number; eventLogSince: string | null;
  };
  participants: {
    name: string; humanIdeas: number; aiCardsAdded: number; avgIdeaLength: number; comments: number; commentsOnOthers: number;
    chats: number; aiChats: number; analysisRequests: number; edits: number; deletes: number; activeMinutes: number | null;
  }[];
  timeline: { bucketMin: number; buckets: { startMin: number; human: number; ai: number }[] };
  analyses: { atMin: number; agentType: string; requester: string }[];
  agentEffects: { agentType: string; requests: number; avgHumanIdeasBefore: number | null; avgHumanIdeasAfter: number | null; avgChange: number | null; aiCardsAdopted: number }[];
  windowMin: number;
}

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-bold tabular-nums mt-1">{value}</div>
    {hint && <div className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</div>}
  </div>
);

const Section: React.FC<{ title: string; desc?: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, desc, right, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
    <div className="flex items-start gap-3 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="ml-auto shrink-0">{right}</div>
    </div>
    {children}
  </section>
);

const ResearchTab: React.FC<{ onError: (e: unknown) => void; initialRoom: string | null }> = ({ onError, initialRoom }) => {
  const [rooms, setRooms] = useState<string[]>([]);
  const [room, setRoom] = useState<string | null>(initialRoom);
  const [anon, setAnon] = useState(true);
  const [windowMin, setWindowMin] = useState(5);
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJson<{ rooms: { roomId: string }[] }>("/overview")
      .then((o) => {
        const ids = o.rooms.map((r) => r.roomId);
        setRooms(ids);
        setRoom((cur) => cur ?? ids[0] ?? null);
      })
      .catch((e) => { onError(e); setErr(e.message); });
  }, [onError]);

  const query = `?anon=${anon ? 1 : 0}&window=${windowMin}`;
  useEffect(() => {
    if (!room) return;
    setLoading(true);
    getJson<Metrics>(`${roomPath(room)}/metrics${query}`)
      .then((d) => { setM(d); setErr(null); })
      .catch((e) => { onError(e); setErr(e.message); })
      .finally(() => setLoading(false));
  }, [room, query, onError]);

  const dl = (kind: string) => room && download(`${roomPath(room)}/csv/${kind}${query}`).catch((e) => { onError(e); setErr(e.message); });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-gray-500">방</span>
          <select value={room ?? ""} onChange={(e) => setRoom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          <span>이름 익명화 (P1, P2 …)</span>
        </label>
        <label className="text-sm flex items-center gap-2">
          <span className="text-gray-500">분석 전후 비교 구간</span>
          <select value={windowMin} onChange={(e) => setWindowMin(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            {[3, 5, 10, 15, 30].map((w) => <option key={w} value={w}>{w}분</option>)}
          </select>
        </label>
        {loading && <span className="text-xs text-gray-400">계산 중…</span>}
      </div>

      {err && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2.5">{err}</div>}
      {!room && <p className="text-sm text-gray-500">방이 없습니다.</p>}

      {m && room && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="참가자" value={`${m.summary.participants}명`} />
          <Tile label="사람이 낸 아이디어 (유창성)" value={m.summary.humanIdeas}
            hint={m.summary.durationMin > 0 ? `분당 ${m.summary.humanIdeasPerMin}개 · 진행 ${Math.round(m.summary.durationMin)}분` : undefined} />
          <Tile label="AI 결과에서 가져온 카드" value={`${m.summary.aiCards}개`} hint={`전체 카드의 ${fmtPct(m.summary.aiShare)} (AI 의존도)`} />
          <Tile label="평균 아이디어 길이 (정교성)" value={`${m.summary.avgIdeaLength}자`} hint={`첨부 ${m.summary.attachments}개`} />
          <Tile label="참여 균등도 (지니계수)" value={m.summary.giniHumanIdeas}
            hint="0 = 모두 똑같이 냄, 1 = 한 명이 다 냄" />
          <Tile label="댓글" value={m.summary.comments} hint={`남의 카드에 단 비율 ${fmtPct(m.summary.crossCommentShare)}`} />
          <Tile label="AI 분석 요청" value={m.summary.analyses} hint={m.summary.analysisErrors ? `실패 ${m.summary.analysisErrors}회` : undefined} />
          <Tile label="수정 / 삭제된 아이디어" value={`${m.summary.editedIdeas} / ${m.summary.deletedIdeas}`} hint="행동 로그 기준" />
        </div>

        <AiInsight room={room} windowMin={windowMin} onError={onError} />

        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2.5 leading-relaxed space-y-1">
          <p>참가자별 지표는 <b>카드를 추가한 사람의 이름</b> 기준입니다. 한 사람이 대신 입력했거나 같은 사람이 다른 이름으로 들어온 경우 실제와 다르게 집계됩니다.</p>
          <p>
          {m.summary.eventLogSince
            ? <>행동 로그(접속 시간·수정·삭제·AI 채팅 등)는 <b>{fmtTime(m.summary.eventLogSince)}</b>부터 기록되었습니다 ({m.summary.eventCount}건). 그 이전 활동은 저장된 결과물(카드·분석)로만 계산됩니다.</>
            : <>이 방에는 아직 행동 로그가 없습니다. 접속 시간·수정·삭제 지표는 이번 업데이트 이후 활동부터 집계됩니다. 삭제된 카드는 아이디어 수에 포함되지 않습니다.</>}</p>
        </div>

        <Section title="시간에 따른 아이디어 생성"
          desc={`${m.timeline.bucketMin}분 단위 · 위쪽 ▼ 표시는 AI 분석 시점 · 시작 ${fmtTime(m.summary.start)}`}>
          <Timeline m={m} />
        </Section>

        <Section title="AI 에이전트별 효과"
          desc={`분석 시점 앞뒤 ${m.windowMin}분 동안 사람이 낸 아이디어 수 평균. 같은 시간대에 분석이 겹치면 구간이 중복 집계됩니다.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">에이전트</th>
                <th className="py-2 font-medium text-right">요청 수</th>
                <th className="py-2 font-medium text-right">분석 전</th>
                <th className="py-2 font-medium text-right">분석 후</th>
                <th className="py-2 font-medium text-right">변화</th>
                <th className="py-2 font-medium text-right">보드로 가져간 AI 카드</th>
              </tr></thead>
              <tbody>
                {m.agentEffects.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">분석 기록이 없습니다</td></tr>}
                {m.agentEffects.map((a) => (
                  <tr key={a.agentType} className="border-b border-gray-50">
                    <td className="py-2">{agentLabel(a.agentType)}</td>
                    <td className="py-2 text-right tabular-nums">{a.requests}</td>
                    <td className="py-2 text-right tabular-nums">{a.avgHumanIdeasBefore ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{a.avgHumanIdeasAfter ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {a.avgChange == null ? "—" : `${a.avgChange > 0 ? "▲ +" : a.avgChange < 0 ? "▼ " : ""}${a.avgChange}`}
                    </td>
                    <td className="py-2 text-right tabular-nums">{a.aiCardsAdopted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid gap-4 md:grid-cols-3">
          <Section title="카테고리 분포" desc="사람이 낸 아이디어 기준 (수렴 과정)">
            <CategoryBars counts={m.summary.categoryCounts} />
          </Section>
          <div className="md:col-span-2">
            <Section title="참가자별 기여" desc={anon ? "이름은 처음 활동한 순서대로 P1, P2 …" : undefined}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 font-medium">참가자</th>
                    <th className="py-2 font-medium text-right">아이디어</th>
                    <th className="py-2 font-medium text-right">AI 카드</th>
                    <th className="py-2 font-medium text-right">평균 길이</th>
                    <th className="py-2 font-medium text-right">댓글(타인)</th>
                    <th className="py-2 font-medium text-right">AI 채팅</th>
                    <th className="py-2 font-medium text-right">분석 요청</th>
                    <th className="py-2 font-medium text-right">수정/삭제</th>
                    <th className="py-2 font-medium text-right">접속(분)</th>
                  </tr></thead>
                  <tbody>
                    {m.participants.map((p) => (
                      <tr key={p.name} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="py-2 text-right tabular-nums">{p.humanIdeas}</td>
                        <td className="py-2 text-right tabular-nums">{p.aiCardsAdded}</td>
                        <td className="py-2 text-right tabular-nums">{p.avgIdeaLength}</td>
                        <td className="py-2 text-right tabular-nums">{p.comments}({p.commentsOnOthers})</td>
                        <td className="py-2 text-right tabular-nums">{p.aiChats}</td>
                        <td className="py-2 text-right tabular-nums">{p.analysisRequests}</td>
                        <td className="py-2 text-right tabular-nums">{p.edits}/{p.deletes}</td>
                        <td className="py-2 text-right tabular-nums">{p.activeMinutes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>

        <Section title="데이터 내보내기 (CSV)" desc={`엑셀·R·SPSS에서 바로 열 수 있습니다. ${anon ? "이름이 익명화되어 내보내집니다. 단, 글 내용 안에 적힌 이름은 바뀌지 않습니다." : "⚠ 실명이 포함됩니다."}`}>
          <div className="flex flex-wrap gap-2">
            {([["participants", "참가자별 지표"], ["ideas", "아이디어"], ["comments", "댓글"], ["analyses", "AI 분석 요청"], ["events", "행동 로그 전체"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => dl(k)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                ⬇ {label}
              </button>
            ))}
          </div>
        </Section>
      </>}
    </div>
  );
};

// ── AI 해석
interface Insight { text: string; model: string; generatedAt: string; cached: boolean }

const AiInsight: React.FC<{ room: string; windowMin: number; onError: (e: unknown) => void }> = ({ room, windowMin, onError }) => {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 방이나 비교 구간이 바뀌면 이전 해석은 숨김
  useEffect(() => { setInsight(null); setErr(null); }, [room, windowMin]);

  const run = async (force: boolean) => {
    setBusy(true); setErr(null);
    try { setInsight(await sendJson<Insight>("POST", `${roomPath(room)}/insight`, { window: windowMin, force })); }
    catch (e: any) { onError(e); setErr(e.message); }
    finally { setBusy(false); }
  };

  const md = {
    h2: (p: any) => <h3 className="text-sm font-bold text-gray-900 mt-4 first:mt-0 mb-1.5" {...p} />,
    h3: (p: any) => <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1" {...p} />,
    p: (p: any) => <p className="text-sm text-gray-700 leading-relaxed mb-2" {...p} />,
    ul: (p: any) => <ul className="list-disc pl-5 space-y-1 mb-2 text-sm text-gray-700 leading-relaxed" {...p} />,
    ol: (p: any) => <ol className="list-decimal pl-5 space-y-1 mb-2 text-sm text-gray-700 leading-relaxed" {...p} />,
    strong: (p: any) => <strong className="font-semibold text-gray-900" {...p} />,
  };

  return (
    <Section title="AI 해석"
      desc="지표를 AI가 읽고 연구 관점에서 설명합니다. 이름은 익명(P1, P2 …)으로, 카드·채팅 내용은 보내지 않고 숫자만 전송합니다."
      right={insight && !busy ? (
        <button onClick={() => run(true)} className="text-xs text-gray-500 hover:text-gray-800">다시 생성</button>
      ) : undefined}>
      {!insight && !busy && (
        <button onClick={() => run(false)}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">
          ✨ AI 해석 생성
        </button>
      )}
      {busy && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          지표를 읽고 해석하는 중… (보통 30초~1분)
        </div>
      )}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {insight && !busy && (
        <div>
          <ReactMarkdown components={md}>{insight.text}</ReactMarkdown>
          <p className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
            {fmtTime(insight.generatedAt)} 생성{insight.cached ? " (저장된 결과)" : ""} · AI가 작성한 해석이므로 수치와 함께 직접 확인하세요.
          </p>
        </div>
      )}
    </Section>
  );
};

// ── 시간대별 스택 막대 (사람 / AI) + 분석 시점 마커
const Timeline: React.FC<{ m: Metrics }> = ({ m }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const { buckets, bucketMin } = m.timeline;
  if (buckets.length === 0) return <p className="text-sm text-gray-400">데이터가 없습니다</p>;

  const H = 220, padL = 32, padR = 8, padT = 22, padB = 26;
  const plotW = width - padL - padR, plotH = H - padT - padB;
  const maxV = Math.max(1, ...buckets.map((b) => b.human + b.ai));
  const niceMax = maxV <= 4 ? maxV : Math.ceil(maxV / 4) * 4;
  const ticks = Array.from(new Set([0, niceMax / 2, niceMax].map((v) => Math.round(v))));
  const slot = plotW / buckets.length;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const totalMin = buckets.length * bucketMin;
  const xMin = (min: number) => padL + (min / totalMin) * plotW;
  const labelEvery = Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 56)));

  const roundedTop = (x: number, top: number, w: number, h: number, r: number) => {
    r = Math.min(r, w / 2, h);
    return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C_HUMAN }} />사람 아이디어</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C_AI }} />AI 결과에서 가져온 카드</span>
        <span className="flex items-center gap-1.5"><span className="text-gray-500">▼</span>AI 분석</span>
        <button onClick={() => setAsTable((v) => !v)} className="ml-auto text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline">
          {asTable ? "그래프로 보기" : "표로 보기"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-1.5 font-medium">구간</th><th className="py-1.5 font-medium text-right">사람</th><th className="py-1.5 font-medium text-right">AI 카드</th><th className="py-1.5 font-medium pl-4">분석</th></tr></thead>
            <tbody>
              {buckets.map((b) => {
                const as = m.analyses.filter((a) => a.atMin >= b.startMin && a.atMin < b.startMin + bucketMin);
                return (
                  <tr key={b.startMin} className="border-b border-gray-50">
                    <td className="py-1.5">{b.startMin}–{b.startMin + bucketMin}분</td>
                    <td className="py-1.5 text-right tabular-nums">{b.human}</td>
                    <td className="py-1.5 text-right tabular-nums">{b.ai}</td>
                    <td className="py-1.5 pl-4 text-gray-600">{as.map((a) => agentLabel(a.agentType)).join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative">
          <svg width={width} height={H} role="img" aria-label="시간대별 아이디어 생성 막대 그래프">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={padL - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">{t}</text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const x = padL + i * slot + (slot - barW) / 2;
              const hH = (b.human / niceMax) * plotH;
              const aH = (b.ai / niceMax) * plotH;
              const gap = b.human > 0 && b.ai > 0 ? 2 : 0;
              const base = padT + plotH;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill={hover === i ? "#f3f4f6" : "transparent"} />
                  {b.human > 0 && <path d={b.ai > 0 ? `M${x},${base} V${base - hH} H${x + barW} V${base} Z` : roundedTop(x, base - hH, barW, hH, 4)} fill={C_HUMAN} />}
                  {b.ai > 0 && <path d={roundedTop(x, base - hH - gap - aH, barW, aH, 4)} fill={C_AI} />}
                  {i % labelEvery === 0 && (
                    <text x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b7280">{b.startMin}분</text>
                  )}
                </g>
              );
            })}
            {m.analyses.map((a, i) => (
              <text key={i} x={xMin(a.atMin)} y={padT - 8} textAnchor="middle" fontSize={10} fill="#4b5563">
                <title>{`${a.atMin}분 · ${agentLabel(a.agentType)} · ${a.requester}`}</title>▼
              </text>
            ))}
          </svg>
          {hover != null && (() => {
            const b = buckets[hover];
            const as = m.analyses.filter((a) => a.atMin >= b.startMin && a.atMin < b.startMin + bucketMin);
            const left = Math.min(width - 180, Math.max(0, padL + hover * slot + slot / 2 - 90));
            return (
              <div className="absolute top-0 pointer-events-none bg-white border border-gray-200 shadow-md rounded-lg px-3 py-2 text-xs w-[180px]" style={{ left }}>
                <div className="font-semibold text-gray-800 mb-1">{b.startMin}–{b.startMin + bucketMin}분</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_HUMAN }} />사람 <b className="ml-auto tabular-nums">{b.human}</b></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_AI }} />AI 카드 <b className="ml-auto tabular-nums">{b.ai}</b></div>
                {as.length > 0 && <div className="mt-1 pt-1 border-t border-gray-100 text-gray-600">분석: {as.map((a) => agentLabel(a.agentType)).join(", ")}</div>}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const CategoryBars: React.FC<{ counts: Record<string, number> }> = ({ counts }) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="text-sm text-gray-400">데이터가 없습니다</p>;
  return (
    <div className="space-y-2.5">
      {entries.map(([k, v]) => (
        <div key={k} title={`${CATEGORY_LABELS[k] ?? k}: ${v}개`}>
          <div className="flex text-xs text-gray-600 mb-1"><span>{CATEGORY_LABELS[k] ?? k}</span><span className="ml-auto tabular-nums text-gray-800 font-medium">{v}</span></div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: C_HUMAN }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResearchTab;
