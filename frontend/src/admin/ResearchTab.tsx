import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getJson, download, roomPath } from "./api";
import { agentLabel, fmtPct, fmtTime, CATEGORY_LABELS } from "./format";
import InfoTip, { TIPS, TipContent } from "./InfoTip";

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
  concretization: Concretization;
}

interface ConcGroup { n: number; editedShare: number | null; avgEdits: number | null; avgLengthChange: number | null; avgSpecificityChange: number | null; progressedShare: number | null }
interface Concretization {
  humanIdeas: number; trackedIdeas: number; untrackedIdeas: number; totalEdits: number; windowMin: number;
  analyzed: ConcGroup & { editedAfterAnalysisShare: number | null; editedWithinWindowShare: number | null; avgLengthChangeSinceAnalysis: number | null; avgSpecificityChangeSinceAnalysis: number | null };
  notAnalyzed: ConcGroup;
}

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string; tip?: TipContent }> = ({ label, value, hint, tip }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="text-xs text-gray-500 flex items-center">{label}{tip && <InfoTip tip={tip} label={label} />}</div>
    <div className="text-xl font-bold tabular-nums mt-1">{value}</div>
    {hint && <div className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</div>}
  </div>
);

const Section: React.FC<{ title: string; desc?: string; right?: React.ReactNode; tip?: TipContent; children: React.ReactNode }> = ({ title, desc, right, tip, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
    <div className="flex items-start gap-3 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800 flex items-center">{title}{tip && <InfoTip tip={tip} label={title} />}</h2>
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
          <Tile label="참가자" value={`${m.summary.participants}명`} tip={TIPS.participants} />
          <Tile label="사람이 낸 아이디어 (유창성)" value={m.summary.humanIdeas} tip={TIPS.fluency}
            hint={m.summary.durationMin > 0 ? `분당 ${m.summary.humanIdeasPerMin}개 · 진행 ${Math.round(m.summary.durationMin)}분` : undefined} />
          <Tile label="AI 결과에서 가져온 카드" value={`${m.summary.aiCards}개`} tip={TIPS.aiShare} hint={`전체 카드의 ${fmtPct(m.summary.aiShare)} (AI 의존도)`} />
          <Tile label="평균 아이디어 길이 (정교성)" value={`${m.summary.avgIdeaLength}자`} tip={TIPS.elaboration} hint={`첨부 ${m.summary.attachments}개`} />
          <Tile label="참여 균등도 (지니계수)" value={m.summary.giniHumanIdeas} tip={TIPS.gini}
            hint="0 = 모두 똑같이 냄, 1 = 한 명이 다 냄" />
          <Tile label="댓글" value={m.summary.comments} tip={TIPS.comments} hint={`남의 카드에 단 비율 ${fmtPct(m.summary.crossCommentShare)}`} />
          <Tile label="AI 분석 요청" value={m.summary.analyses} tip={TIPS.analyses} hint={m.summary.analysisErrors ? `실패 ${m.summary.analysisErrors}회` : undefined} />
          <Tile label="수정 / 삭제된 아이디어" value={`${m.summary.editedIdeas} / ${m.summary.deletedIdeas}`} tip={TIPS.editsDeletes} hint="행동 로그 기준" />
        </div>

        <ObjectiveSummary m={m} />

        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2.5 leading-relaxed space-y-1">
          <p>참가자별 지표는 <b>카드를 추가한 사람의 이름</b> 기준입니다. 한 사람이 대신 입력했거나 같은 사람이 다른 이름으로 들어온 경우 실제와 다르게 집계됩니다.</p>
          <p>
          {m.summary.eventLogSince
            ? <>행동 로그(접속 시간·수정·삭제 등)는 <b>{fmtTime(m.summary.eventLogSince)}</b>부터 기록되었습니다 ({m.summary.eventCount}건). 그 이전 활동은 저장된 결과물(카드·분석)로만 계산됩니다.</>
            : <>이 방에는 아직 행동 로그가 없습니다. 접속 시간·수정·삭제 지표는 이번 업데이트 이후 활동부터 집계됩니다. 삭제된 카드는 아이디어 수에 포함되지 않습니다.</>}</p>
        </div>

        <Section title="시간에 따른 아이디어 생성" tip={TIPS.timeline}
          desc={`${m.timeline.bucketMin}분 단위 · 위쪽 ▼ 표시는 AI 분석 시점 · 시작 ${fmtTime(m.summary.start)}`}>
          <Timeline m={m} />
        </Section>

        <Section title="AI 에이전트별 효과"
          desc={`분석 시점 앞뒤 ${m.windowMin}분 동안 사람이 낸 아이디어 수 평균. 같은 시간대에 분석이 겹치면 구간이 중복 집계됩니다.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">에이전트</th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center">요청 수<InfoTip tip={TIPS.agentRequests} label="요청 수" /></span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center">분석 전<InfoTip tip={TIPS.agentBefore} label="분석 전" /></span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center">분석 후<InfoTip tip={TIPS.agentAfter} label="분석 후" /></span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center">변화<InfoTip tip={TIPS.agentChange} label="변화" /></span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center">보드로 가져간 AI 카드<InfoTip tip={TIPS.agentAdopted} label="보드로 가져간 AI 카드" /></span></th>
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

        <ConcretizationSection c={m.concretization} onDownload={dl} />

        <div className="grid gap-4 md:grid-cols-3">
          <Section title="카테고리 분포" tip={TIPS.category} desc="사람이 낸 아이디어 기준 (수렴 과정)">
            <CategoryBars counts={m.summary.categoryCounts} />
          </Section>
          <div className="md:col-span-2">
            <Section title="참가자별 기여" desc={anon ? "이름은 처음 활동한 순서대로 P1, P2 …" : undefined}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 font-medium">참가자</th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">아이디어<InfoTip tip={TIPS.pIdeas} label="아이디어" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">AI 카드<InfoTip tip={TIPS.pAiCards} label="AI 카드" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">평균 길이<InfoTip tip={TIPS.pLen} label="평균 길이" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">댓글(타인)<InfoTip tip={TIPS.pComments} label="댓글(타인)" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">분석 요청<InfoTip tip={TIPS.pRequests} label="분석 요청" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">수정/삭제<InfoTip tip={TIPS.pEdits} label="수정/삭제" /></span></th>
                    <th className="py-2 font-medium text-right"><span className="inline-flex items-center">접속(분)<InfoTip tip={TIPS.pActive} label="접속(분)" /></span></th>
                  </tr></thead>
                  <tbody>
                    {m.participants.map((p) => (
                      <tr key={p.name} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="py-2 text-right tabular-nums">{p.humanIdeas}</td>
                        <td className="py-2 text-right tabular-nums">{p.aiCardsAdded}</td>
                        <td className="py-2 text-right tabular-nums">{p.avgIdeaLength}</td>
                        <td className="py-2 text-right tabular-nums">{p.comments}({p.commentsOnOthers})</td>
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

        <Section title="데이터 내보내기 (CSV)" desc={`엑셀·R·SPSS에서 바로 열 수 있습니다. ${anon ? "이름이 익명화되어 내보내집니다. 단, 글 내용 안에 적힌 이름은 바뀌지 않습니다." : "⚠ 입장 이름이 그대로 포함됩니다."} 아이디어 파일에는 삭제된 카드도 status=deleted로 함께 들어갑니다(삭제 시각·삭제한 사람 포함, 행동 로그 기록 이후 삭제분).`}>
          <div className="flex flex-wrap gap-2">
            {([["participants", "참가자별 지표"], ["ideas", "아이디어 (삭제 포함)"], ["comments", "댓글"], ["analyses", "AI 분석 요청"], ["concretization", "아이디어 구체화 (카드별, 삭제 포함)"], ["events", "행동 로그 전체"]] as const).map(([k, label]) => (
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

// ── 지표 요약: 숫자를 정해진 규칙으로 문장화 (평가·추측 없이 사실만, 같은 데이터면 항상 같은 결과)
const MIN_REQUESTS_FOR_COMPARISON = 3;
const STALL_MIN = 5;

const signed = (n: number | null | undefined) => (n == null ? "—" : n > 0 ? `+${n}` : `${n}`);

export function buildSummary(m: Metrics): { title: string; lines: string[] }[] {
  const s = m.summary;
  const groups: { title: string; lines: string[] }[] = [];
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  // 1. 규모
  const scale: string[] = [];
  if (s.durationMin > 0) {
    scale.push(`참가자 ${s.participants}명이 ${Math.round(s.durationMin)}분 동안 아이디어 ${s.humanIdeas}개를 직접 작성했습니다 (분당 ${s.humanIdeasPerMin}개).`);
  } else {
    scale.push(`참가자 ${s.participants}명이 아이디어 ${s.humanIdeas}개를 직접 작성했습니다.`);
  }
  scale.push(`아이디어 1개의 평균 길이는 ${s.avgIdeaLength}자이고, 첨부 파일은 ${s.attachments}개입니다.`);
  if (s.editedIdeas || s.deletedIdeas) scale.push(`행동 로그 기준으로 아이디어 수정 ${s.editedIdeas}회, 삭제 ${s.deletedIdeas}회가 있었습니다.`);
  groups.push({ title: "규모", lines: scale });

  // 2. 참여 분포
  const part: string[] = [];
  const ranked = [...m.participants].sort((a, b) => b.humanIdeas - a.humanIdeas);
  if (ranked.length > 0 && s.humanIdeas > 0) {
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    part.push(`가장 많이 작성한 참가자는 ${top.name}로 ${top.humanIdeas}개(전체의 ${pct(top.humanIdeas, s.humanIdeas)}%)이고, 가장 적게 작성한 참가자는 ${bottom.name}로 ${bottom.humanIdeas}개입니다.`);
    const zero = ranked.filter((p) => p.humanIdeas === 0).map((p) => p.name);
    if (zero.length) part.push(`아이디어를 작성하지 않은 참가자: ${zero.join(", ")} (${zero.length}명).`);
    part.push(`지니계수는 ${s.giniHumanIdeas}입니다 (0 = 모든 참가자가 같은 개수, 1 = 한 명이 전부 작성).`);
  }
  if (s.comments > 0) {
    part.push(`댓글 ${s.comments}개 중 ${pct(Math.round(s.crossCommentShare * s.comments), s.comments)}%가 다른 사람의 카드에 달렸습니다.`);
  } else {
    part.push("댓글은 없습니다.");
  }
  if (ranked.length > 0 && ranked.length < 3) part.push(`참가자가 ${ranked.length}명이라 분포 지표(지니계수 등)는 작은 차이에도 크게 변합니다.`);
  groups.push({ title: "참여 분포", lines: part });

  // 3. 시간 흐름
  const time: string[] = [];
  const { buckets, bucketMin } = m.timeline;
  if (buckets.length > 0) {
    // 최다 구간: 너무 잘게 쪼개면 의미가 없어 최소 5분 단위로 묶어서 찾음
    const win = Math.max(bucketMin, 5);
    const per = Math.max(1, Math.round(win / bucketMin));
    const windows: { from: number; to: number; n: number }[] = [];
    for (let i = 0; i < buckets.length; i += per) {
      const slice = buckets.slice(i, i + per);
      windows.push({ from: slice[0].startMin, to: slice[slice.length - 1].startMin + bucketMin, n: slice.reduce((n, b) => n + b.human, 0) });
    }
    const maxN = Math.max(...windows.map((w) => w.n));
    const peaks = windows.filter((w) => w.n === maxN);
    if (maxN > 0 && windows.length > 1) {
      time.push(peaks.length === 1
        ? `${win}분 단위로 보면 사람 아이디어가 가장 많이 나온 구간은 ${peaks[0].from}~${peaks[0].to}분(${maxN}개)입니다.`
        : `${win}분 단위로 보면 최다 구간(${maxN}개)이 ${peaks.length}곳입니다: ${peaks.map((w) => `${w.from}~${w.to}분`).join(", ")}.`);
    }
    // 첫 아이디어와 마지막 아이디어 사이에서 사람 아이디어가 없던 연속 구간
    const firstIdx = buckets.findIndex((b) => b.human > 0);
    let lastIdx = -1; buckets.forEach((b, i) => { if (b.human > 0) lastIdx = i; });
    const stalls: { from: number; to: number }[] = [];
    if (firstIdx >= 0) {
      let i = firstIdx;
      while (i <= lastIdx) {
        if (buckets[i].human === 0) {
          let j = i; while (j <= lastIdx && buckets[j].human === 0) j++;
          const from = buckets[i].startMin, to = buckets[j - 1].startMin + bucketMin;
          if (to - from >= STALL_MIN) stalls.push({ from, to });
          i = j;
        } else i++;
      }
    }
    for (const st of stalls) {
      const inStall = m.analyses.filter((a) => a.atMin >= st.from && a.atMin < st.to);
      time.push(`${st.from}~${st.to}분에는 사람 아이디어가 없었습니다` + (inStall.length ? ` (이 구간에 ${inStall.map((a) => `${a.atMin}분 ${agentLabel(a.agentType)}`).join(", ")} 분석 요청).` : "."));
    }
    if (stalls.length === 0 && firstIdx >= 0) time.push(`첫 아이디어부터 마지막 아이디어 사이에 ${STALL_MIN}분 이상 아이디어가 없던 구간은 없습니다.`);
    if (buckets.length >= 2) {
      const half = Math.ceil(buckets.length / 2);
      const early = buckets.slice(0, half).reduce((n, b) => n + b.human, 0);
      const late = buckets.slice(half).reduce((n, b) => n + b.human, 0);
      time.push(`전반부(0~${half * bucketMin}분) ${early}개, 후반부 ${late}개입니다.`);
    }
  }
  groups.push({ title: "시간 흐름", lines: time });

  // 4. AI 활용
  const ai: string[] = [];
  ai.push(`AI 분석은 ${s.analyses}회 요청되었습니다${s.analysisErrors ? ` (실패 ${s.analysisErrors}회 별도)` : ""}.`);
  ai.push(`보드의 카드 ${s.totalIdeas}개 중 ${s.aiCards}개(${fmtPct(s.aiShare)})가 AI 결과에서 가져온 카드입니다.`);
  for (const a of m.agentEffects) {
    if (a.requests === 0) {
      ai.push(`${agentLabel(a.agentType)}: 남아 있는 분석 기록은 없고, 이 유형에서 가져온 카드가 ${a.aiCardsAdopted}개 있습니다.`);
      continue;
    }
    const ch = a.avgChange ?? 0;
    const dir = ch > 0 ? `${ch}개 많았습니다` : ch < 0 ? `${Math.abs(ch)}개 적었습니다` : "같았습니다";
    const note = a.requests < MIN_REQUESTS_FOR_COMPARISON ? ` 요청이 ${a.requests}회뿐이라 비교 값은 참고용입니다.` : "";
    ai.push(`${agentLabel(a.agentType)}: ${a.requests}회 요청. 분석 후 ${m.windowMin}분 동안의 사람 아이디어가 분석 전 ${m.windowMin}분보다 평균 ${dir} (${a.avgHumanIdeasBefore} → ${a.avgHumanIdeasAfter}개). 이 유형에서 가져온 카드 ${a.aiCardsAdopted}개.${note}`);
  }
  groups.push({ title: "AI 활용", lines: ai });

  // 4-1. 구체화
  const c = m.concretization;
  if (c) {
    const conc: string[] = [];
    if (c.trackedIdeas === 0) {
      conc.push(`수정 이력을 추적할 수 있는 카드가 없습니다 (행동 로그 기록 이후 만든 카드만 추적 가능, 현재 추적 불가 ${c.untrackedIdeas}개).`);
    } else {
      conc.push(`이력을 추적할 수 있는 카드 ${c.trackedIdeas}개 중 AI 분석 대상에 포함된 카드는 ${c.analyzed.n}개, 포함되지 않은 카드는 ${c.notAnalyzed.n}개입니다${c.untrackedIdeas ? ` (추적 불가 ${c.untrackedIdeas}개 제외)` : ""}.`);
      const g = (x: ConcGroup) => `수정된 비율 ${x.editedShare == null ? "—" : fmtPct(x.editedShare)}, 글자 수 변화 평균 ${signed(x.avgLengthChange)}자, 구체 요소 변화 평균 ${signed(x.avgSpecificityChange)}개`;
      if (c.analyzed.n) conc.push(`분석 받은 카드: ${g(c.analyzed)}.`);
      if (c.notAnalyzed.n) conc.push(`분석 받지 않은 카드: ${g(c.notAnalyzed)}.`);
      if (c.analyzed.n) {
        conc.push(`분석 받은 카드 중 ${c.analyzed.editedAfterAnalysisShare == null ? "—" : fmtPct(c.analyzed.editedAfterAnalysisShare)}가 분석 결과 이후 수정되었고, ${c.windowMin}분 안에 수정된 비율은 ${c.analyzed.editedWithinWindowShare == null ? "—" : fmtPct(c.analyzed.editedWithinWindowShare)}입니다.`);
        if (c.analyzed.avgLengthChangeSinceAnalysis != null) conc.push(`분석 시점 버전과 비교하면 현재 버전은 글자 수 평균 ${signed(c.analyzed.avgLengthChangeSinceAnalysis)}자, 구체 요소 평균 ${signed(c.analyzed.avgSpecificityChangeSinceAnalysis)}개 변했습니다.`);
      }
      if (c.analyzed.n < 5 || c.notAnalyzed.n < 5) conc.push("한쪽 그룹의 카드가 5개 미만이라 그룹 간 비교 값은 참고용입니다.");
    }
    groups.push({ title: "아이디어 구체화", lines: conc });
  }

  // 5. 수렴
  const cats = Object.entries(s.categoryCounts);
  if (cats.length) {
    const total = cats.reduce((n, [, v]) => n + v, 0);
    const conv = (s.categoryCounts.candidate ?? 0) + (s.categoryCounts.review ?? 0);
    groups.push({ title: "수렴", lines: [
      `현재 사람 아이디어 ${total}개 중 ${conv}개(${pct(conv, total)}%)가 '후보 아이디어' 또는 '최종 검토' 카테고리에 있습니다.`,
      `카테고리별: ${cats.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${CATEGORY_LABELS[k] ?? k} ${v}개`).join(", ")}.`,
    ] });
  }

  // 6. 데이터 범위
  groups.push({ title: "데이터 범위", lines: [
    s.eventLogSince
      ? `행동 로그는 ${fmtTime(s.eventLogSince)}부터 ${s.eventCount}건 기록되었습니다. 접속 시간·수정·삭제 지표는 이 시점 이후만 반영됩니다.`
      : "행동 로그가 없어 접속 시간·수정·삭제 지표는 측정되지 않았습니다(0으로 표시되어도 '없었음'이 아님).",
    "삭제된 카드는 아이디어 수에 포함되지 않습니다. 참가자는 입장 이름으로 구분됩니다.",
  ] });

  return groups.filter((g) => g.lines.length > 0);
}

const ObjectiveSummary: React.FC<{ m: Metrics }> = ({ m }) => {
  const groups = buildSummary(m);
  const copy = () => navigator.clipboard?.writeText(groups.map((g) => `[${g.title}]\n` + g.lines.map((l) => `- ${l}`).join("\n")).join("\n\n")).catch(() => {});
  return (
    <Section title="지표 요약"
      desc="지표 값을 정해진 규칙에 따라 문장으로 옮긴 것입니다. 평가나 추측 없이 데이터가 보여 주는 사실만 적습니다."
      right={<button onClick={copy} className="text-xs text-gray-500 hover:text-gray-800">복사</button>}>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-xs font-semibold text-gray-500 mb-1.5">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.lines.map((l, i) => <li key={i} className="text-sm text-gray-800 leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-gray-400">{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
};

// ── 아이디어 구체화
const ConcretizationSection: React.FC<{ c: Concretization; onDownload: (kind: string) => void }> = ({ c, onDownload }) => {
  const pctOr = (v: number | null) => (v == null ? "—" : fmtPct(v));
  const rows: { label: string; tip: TipContent; a: React.ReactNode; b: React.ReactNode }[] = [
    { label: "카드 수", tip: TIPS.concGroups, a: c.analyzed.n, b: c.notAnalyzed.n },
    { label: "수정된 비율", tip: TIPS.concEdited, a: pctOr(c.analyzed.editedShare), b: pctOr(c.notAnalyzed.editedShare) },
    { label: "평균 수정 횟수", tip: TIPS.concAvgEdits, a: c.analyzed.avgEdits ?? "—", b: c.notAnalyzed.avgEdits ?? "—" },
    { label: "글자 수 변화 (첫→최종)", tip: TIPS.concLen, a: signed(c.analyzed.avgLengthChange), b: signed(c.notAnalyzed.avgLengthChange) },
    { label: "구체 요소 변화 (첫→최종)", tip: TIPS.concSpec, a: signed(c.analyzed.avgSpecificityChange), b: signed(c.notAnalyzed.avgSpecificityChange) },
    { label: "단계 진전 비율", tip: TIPS.concProgress, a: pctOr(c.analyzed.progressedShare), b: pctOr(c.notAnalyzed.progressedShare) },
  ];
  return (
    <Section title="아이디어 구체화"
      desc={`AI 분석을 받은 아이디어가 이후 얼마나 다듬어졌는지 봅니다. 추적 가능 ${c.trackedIdeas}개 / 추적 불가 ${c.untrackedIdeas}개 (총 수정 ${c.totalEdits}회).`}
      tip={TIPS.concTracked}>
      {c.trackedIdeas === 0 ? (
        <p className="text-sm text-gray-500">아직 수정 이력을 추적할 수 있는 카드가 없습니다. 행동 로그 기록 이후 새로 만든 카드부터 집계됩니다.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-5">
          <div className="md:col-span-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">지표</th>
                <th className="py-2 font-medium text-right">AI 분석 받음</th>
                <th className="py-2 font-medium text-right">받지 않음</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-gray-50">
                    <td className="py-2"><span className="inline-flex items-center">{r.label}<InfoTip tip={r.tip} label={r.label} /></span></td>
                    <td className="py-2 text-right tabular-nums font-medium">{r.a}</td>
                    <td className="py-2 text-right tabular-nums">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:col-span-2 space-y-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500 flex items-center">AI 결과 이후 수정<InfoTip tip={TIPS.concAfterAnalysis} label="AI 결과 이후 수정" /></div>
              <div className="text-sm mt-1"><b className="tabular-nums">{pctOr(c.analyzed.editedAfterAnalysisShare)}</b> <span className="text-gray-500">결과 이후 수정</span></div>
              <div className="text-sm"><b className="tabular-nums">{pctOr(c.analyzed.editedWithinWindowShare)}</b> <span className="text-gray-500">결과 후 {c.windowMin}분 안에 수정</span></div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500 flex items-center">분석 시점 → 현재<InfoTip tip={TIPS.concSinceAnalysis} label="분석 시점 → 현재" /></div>
              <div className="text-sm mt-1">글자 수 <b className="tabular-nums">{signed(c.analyzed.avgLengthChangeSinceAnalysis)}</b> · 구체 요소 <b className="tabular-nums">{signed(c.analyzed.avgSpecificityChangeSinceAnalysis)}</b></div>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 inline-flex items-center mr-1">사람 평가용<InfoTip tip={TIPS.rating} label="사람 평가용 파일" /></span>
        <button onClick={() => onDownload("rating-sheet")} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">⬇ 평가지 (평가자에게 배포)</button>
        <button onClick={() => onDownload("rating-key")} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">⬇ 정답 키 (연구자 보관)</button>
      </div>
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
