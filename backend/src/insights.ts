import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { computeMetrics, RoomData } from "./metrics";

// 연구 지표를 Claude가 읽고 연구자에게 해석해 주는 기능.
// 개인정보 보호: 이름은 항상 P1, P2 … 로 익명화하고, 카드·채팅 본문은 보내지 않음(지표 숫자만 전송).

const MODEL = "claude-opus-5-5";

const AGENT_NAMES: Record<string, string> = {
  suggestion: "관점 제시형", question: "관점 탐색형", emphasis: "효과 예측형",
  attribute: "속성 분석형", guide: "결과 제시형", advise: "결과 선택형", general: "기본 분석",
};

const SYSTEM_PROMPT = `당신은 협업 아이디어 회의(브레인스토밍)와 인간-AI 협업을 연구하는 연구자를 돕는 연구 조교입니다.
연구자가 한 회의 방의 정량 지표(JSON)를 주면, 한국어로 해석을 써 줍니다. 독자는 통계 전문가가 아닐 수 있는 대학원생 연구자입니다.

지표 정의:
- humanIdeas: 참가자가 직접 쓴 아이디어 카드 수(유창성). aiCards: AI 분석 결과에서 보드로 가져온 카드 수. aiShare: 전체 카드 중 AI 카드 비율(AI 의존도).
- avgIdeaLength: 사람 아이디어의 제목+본문 평균 글자 수(정교성의 대리 지표).
- giniHumanIdeas: 참가자별 아이디어 수의 지니계수. 0이면 모두 같은 수, 1에 가까울수록 소수에게 쏠림.
- crossCommentShare: 전체 댓글 중 남의 카드에 단 댓글 비율(상호작용).
- timeline: bucketMin 분 단위 구간별 사람/AI 카드 생성 수. analyses: AI 분석 시점(시작 후 분)과 에이전트 유형.
- agentEffects: 에이전트 유형별로 분석 시점 앞뒤 windowMin 분 동안 사람이 낸 아이디어 수의 평균(before/after)과 변화량, 그리고 그 유형의 결과에서 보드로 가져간 AI 카드 수.
- categoryCounts: 사람 아이디어만의 카테고리 분포(AI 카드는 제외하므로 합계가 totalIdeas보다 작은 것이 정상).
- 분석 내역은 참가자가 화면에서 삭제할 수 있어, 분석 기록(analyses)보다 AI 카드가 많을 수 있습니다. 이 경우 오류로 단정하지 말고 "삭제된 분석에서 온 카드일 수 있음"으로 다루세요.
- concretization: 아이디어 구체화. 행동 로그로 버전 이력이 있는 카드(trackedIdeas)만 대상. analyzed = AI 분석 대상에 포함된 카드, notAnalyzed = 포함되지 않은 카드.
  avgLengthChange/avgSpecificityChange = 최종 버전 − 첫 버전의 글자 수/구체 요소 수(숫자 표현 + 목록 항목) 평균, progressedShare = 카테고리가 후보/최종 검토 쪽으로 올라간 비율,
  editedWithinWindowShare = 분석 결과 후 windowMin 분 안에 수정된 비율, ...SinceAnalysis = 분석 시점 버전 → 최종 버전 변화. 글자 수·구체 요소 수는 구체성의 대리 지표일 뿐이며, 두 그룹은 무작위 배정이 아니므로 차이를 AI 효과로 단정하지 마세요.
- editedIdeas/deletedIdeas/activeMinutes 등은 행동 로그(eventLogSince 이후)에서만 계산됩니다. eventCount가 0이면 해당 지표는 아직 측정되지 않은 것입니다.

작성 원칙:
- 숫자를 근거로 말하고, 근거가 되는 숫자를 문장 안에 함께 적으세요.
- 인과관계를 단정하지 마세요. "~와 함께 나타났다", "~일 가능성이 있다"처럼 쓰고, 다른 설명(회의 후반의 자연스러운 감소, 표본이 작음, 분석 구간 겹침 등)이 가능하면 짚어 주세요.
- 요청 수나 참가자 수가 적어 결론을 내리기 어려운 지표는 그렇다고 분명히 말하세요.
- 측정되지 않은 지표(값이 null, 0건의 로그 등)를 근거로 해석하지 마세요.
- 참가자는 P1, P2 처럼 익명 ID로만 언급하세요.

출력 형식(마크다운, 전체 600~900자 내외, 군더더기 없이):
## 한눈에 보기
핵심 발견 3개 이내의 글머리표.
## 눈에 띄는 패턴
시간 흐름, 참여 균형, AI 활용에 대해 데이터가 보여 주는 것.
## AI 에이전트별 해석
요청이 있었던 유형만. 데이터가 부족하면 한 줄로 그렇다고 적기.
## 해석할 때 주의할 점
이 방의 데이터에 해당하는 한계만 2~3개.
## 다음에 확인해 볼 것
논문용으로 추가하면 좋을 분석이나 실험 설계 제안 2~3개.`;

export interface InsightResult {
  text: string;
  model: string;
  generatedAt: string;
  cached: boolean;
}

// 같은 데이터·설정이면 다시 호출하지 않음 (비용 절약). 서버 재시작 시 초기화.
const cache = new Map<string, InsightResult>();

export async function generateInsight(roomId: string, room: RoomData, windowMin: number, force = false): Promise<InsightResult> {
  const metrics = computeMetrics(room, { anon: true, windowMin });
  const payload = {
    ...metrics,
    analyses: metrics.analyses.map((a) => ({ ...a, agentName: AGENT_NAMES[a.agentType] ?? a.agentType })),
    agentEffects: metrics.agentEffects.map((a) => ({ ...a, agentName: AGENT_NAMES[a.agentType] ?? a.agentType })),
  };
  const json = JSON.stringify(payload);
  const key = crypto.createHash("sha256").update(`${roomId}:${json}`).digest("hex");
  const hit = cache.get(key);
  if (hit && !force) return { ...hit, cached: true };

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 설정되지 않아 AI 해석을 만들 수 없습니다.");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 5 * 60 * 1000 });

  // 설치된 SDK(0.39)의 타입 정의에는 최신 필드(output_config, adaptive thinking, fallbacks)가 없어 캐스팅.
  // 요청 본문은 그대로 API로 전달됨.
  const params = {
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // 안전 분류기가 거절하면 서버가 적절한 다른 모델로 자동 재시도
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `방 "${roomId}"의 지표입니다. 위 형식으로 해석해 주세요.\n\n\`\`\`json\n${json}\n\`\`\``,
    }],
  };
  const response = (await client.beta.messages.create(params as any)) as any;

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청에 대한 해석을 거절했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const text = (response.content as any[])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error(response.stop_reason === "max_tokens" ? "응답이 너무 길어 잘렸습니다. 다시 시도해 주세요." : "AI 응답이 비어 있습니다.");

  const result: InsightResult = { text, model: response.model ?? MODEL, generatedAt: new Date().toISOString(), cached: false };
  cache.set(key, result);
  return result;
}

/** API 오류를 관리자에게 보여 줄 한국어 메시지로 변환 */
export function insightErrorMessage(e: unknown): { status: number; message: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, message: "AI 요청이 많아 잠시 제한되었습니다. 1분 뒤 다시 시도하세요." };
  if (e instanceof Anthropic.AuthenticationError) return { status: 502, message: "AI API 키가 유효하지 않습니다. ANTHROPIC_API_KEY를 확인하세요." };
  if (e instanceof Anthropic.BadRequestError) return { status: 502, message: `AI 요청 형식 오류: ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { status: 504, message: "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요." };
  if (e instanceof Anthropic.APIError) return { status: 502, message: `AI 오류 (${e.status ?? "?"}): ${e.message}` };
  return { status: 500, message: e instanceof Error ? e.message : "알 수 없는 오류" };
}
