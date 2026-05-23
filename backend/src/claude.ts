import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";
import { searchForIdeas, SearchResult } from "./search";

// .env 파일을 명시적 경로로 로딩
dotenv.config({ path: path.join(__dirname, "../../.env"), override: true });
dotenv.config({ path: path.join(__dirname, "../.env"), override: true });

// 클라이언트를 함수 호출 시점에 생성 (env 로딩 이후 보장)
function getClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export interface IdeaInput {
  id: string;
  title: string;
  content: string;
  author: string;
}

export interface AnalysisFile {
  name: string;
  type: "text" | "image";
  mimeType?: string;
  content: string; // text content 또는 base64 data URL
}

export interface ProCon {
  point: string;
  evidence: string;
}

export interface IdeaAnalysis {
  id: string;
  name: string;
  pros: ProCon[];
  cons: ProCon[];
}

export interface AnalysisResult {
  ideas: IdeaAnalysis[];
  commonalities: string[];
  differences: string[];
  agentResponse?: string;
}

type AgentType =
  | "question"
  | "suggestion"
  | "effect"
  | "attribute"
  | "emphasis"
  | "guide"
  | "advise"
  | null;

// attribute용 - 장단점 2열 비교 분석
const ATTRIBUTE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
각 아이디어의 장점과 단점을 구체적으로 분석하고, 공통점과 차이점도 정리해주세요.
각 장/단점에는 짧은 근거(수치, 사례, 출처)를 포함하세요. 마지막으로 팀에게 던지는 탐색 질문 1개를 작성하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "attribute",
  "ideas": [
    {
      "id": "아이디어 ID",
      "name": "아이디어 이름",
      "pros": [
        {"point": "핵심 장점", "evidence": "짧은 근거 (수치/사례)"},
        {"point": "장점 2", "evidence": "근거"}
      ],
      "cons": [
        {"point": "핵심 단점", "evidence": "짧은 근거"},
        {"point": "단점 2", "evidence": "근거"}
      ]
    }
  ],
  "commonalities": ["공통점1", "공통점2"],
  "differences": ["차이점1", "차이점2"],
  "agentResponse": "두 아이디어를 실제로 운영한다면 어떤 장점과 문제점이 생길 수 있고, 이를 어떻게 보완할 수 있을까요?"
}`;

// 관점 제시형 (suggestion) - 빠진 관점 카드
const PERSPECTIVE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 분석하여 현재 논의에서 빠진 관점을 파악하고 한국어로 정리해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "suggestion",
  "summary": "현재 논의 요약 2-3문장",
  "currentFocus": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "perspectives": [
    {"title": "빠진 관점 제목", "description": "설명 1-2문장"},
    {"title": "빠진 관점 제목", "description": "설명"},
    {"title": "빠진 관점 제목", "description": "설명"}
  ]
}`;

// 관점 탐색형 (question) - Q1/Q2/Q3 탐색 질문
const EXPLORE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 탐색하는 시각전환 질문들을 만들어주세요. 각 질문은 팀이 놓치기 쉬운 전제나 관점을 파고드는 열린 질문이어야 합니다. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "question",
  "summary": "현재 논의 요약 2-3문장",
  "currentFocus": ["키워드1", "키워드2", "키워드3"],
  "questions": [
    {"text": "탐색 질문 1 (물음표로 끝나는 질문형)"},
    {"text": "탐색 질문 2"},
    {"text": "탐색 질문 3"}
  ]
}`;

const EFFECT_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 실행했을 때 나타날 수 있는 예상 효과를 분석해주세요. 수치보다는 "~할 것이다", "~로 이어질 것이다", "~에 긍정적인 영향을 줄 것이다" 같은 서술형으로 자연스럽게 작성하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "effect",
  "summary": "아이디어들의 전체적인 방향 요약",
  "currentFocus": ["핵심 키워드1", "핵심 키워드2"],
  "questions": [
    {"text": "예상 효과 1: ~할 것이다 또는 ~로 이어질 것이다 형태로 서술"},
    {"text": "예상 효과 2"},
    {"text": "예상 효과 3"},
    {"text": "예상 효과 4"}
  ]
}`;

const EMPHASIS_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
각 아이디어의 예상 효과를 분석하고, 공통점과 차이점도 정리해주세요. 한국어로 작성하세요.

효과 title 작성 규칙:
- 실제 연구/데이터/사례에 근거한 수치가 있을 때만 "54% 감소↓", "2배 증가↑" 같은 수치를 포함하세요.
- 근거 없이 수치를 만들어내지 마세요. 확실한 근거가 없으면 "소음 충돌 감소 효과", "이용자 만족도 향상" 같은 서술형으로 쓰세요.
- note 필드에는 수치의 출처나 유사 사례를 적으세요. 없으면 빈 문자열("")로 두세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "emphasis",
  "ideas": [
    {
      "name": "아이디어 이름",
      "label": "아이디어 A",
      "effects": [
        {"label": "예상효과 1", "title": "소음 충돌 감소 효과", "description": "설명", "note": "근거 또는 빈 문자열"},
        {"label": "예상효과 2", "title": "재이용 의향 향상", "description": "설명", "note": ""}
      ],
      "similarCase": "유사 사례 설명"
    }
  ],
  "commonalities": ["공통점1", "공통점2"],
  "differences": ["차이점1", "차이점2"]
}`;

const GUIDE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 실현 가능성, 사용자 편의, 주제 차별성 측면에서 0-100 점수로 평가하고 추천 아이디어를 제시해주세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "guide",
  "recommendedIdea": "추천 아이디어 이름",
  "recommendReason": "추천 이유 1-2문장",
  "ideas": [
    {"name": "아이디어 A 이름", "feasibility": 80, "userExperience": 55, "uniqueness": 20},
    {"name": "아이디어 B 이름", "feasibility": 66, "userExperience": 88, "uniqueness": 75}
  ],
  "limitNote": "분석 한계 설명"
}`;

const ADVISE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 실현 가능성, 사용자 편의, 차별성 기준으로 비교하고, 기준별로 어떤 아이디어가 우위인지 안내해주세요. 어느 한 아이디어를 강하게 추천하기보다 팀이 기준을 직접 선택할 수 있도록 안내하는 질문형 코멘트를 작성하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "advise",
  "criteriaResults": [
    {"criterion": "실현 가능성", "winner": "A"},
    {"criterion": "사용자 편의", "winner": "B"},
    {"criterion": "차별성", "winner": "B"}
  ],
  "ideas": [
    {"name": "아이디어 A 이름", "feasibility": 80, "userExperience": 55, "uniqueness": 20},
    {"name": "아이디어 B 이름", "feasibility": 66, "userExperience": 88, "uniqueness": 75}
  ],
  "recommendation": "차별성을 우선한다면 B안, 실현 가능성을 우선한다면 A안이 적합해요. 팀이 가장 중요하게 생각하는 기준이 무엇인가요?",
  "limitNote": "분석 한계 설명"
}`;

export async function analyzeIdeas(
  ideas: IdeaInput[],
  agentType: AgentType = null,
  userMessage: string = "",
  files: AnalysisFile[] = [],
  useSearch: boolean = false
): Promise<AnalysisResult | Record<string, unknown>> {
  if (ideas.length === 0) {
    return {
      ideas: [],
      commonalities: [],
      differences: [],
    };
  }

  const ideasText = ideas
    .map(
      (idea, idx) =>
        `아이디어 ${String.fromCharCode(65 + idx)} (ID: ${idea.id})\n제목: ${idea.title}\n내용: ${idea.content}\n작성자: ${idea.author}`
    )
    .join("\n\n");

  const userMessageInstruction = userMessage
    ? `\n\n사용자 추가 요청: ${userMessage}`
    : "";

  let systemPrompt: string;
  let agentInstruction = "";

  if (agentType === "suggestion") {
    systemPrompt = PERSPECTIVE_SYSTEM_PROMPT;
  } else if (agentType === "question") {
    systemPrompt = EXPLORE_SYSTEM_PROMPT;
  } else if (agentType === "effect") {
    systemPrompt = EFFECT_SYSTEM_PROMPT;
  } else if (agentType === "emphasis") {
    systemPrompt = EMPHASIS_SYSTEM_PROMPT;
  } else if (agentType === "guide") {
    systemPrompt = GUIDE_SYSTEM_PROMPT;
  } else if (agentType === "advise") {
    systemPrompt = ADVISE_SYSTEM_PROMPT;
  } else if (agentType === "attribute") {
    systemPrompt = ATTRIBUTE_SYSTEM_PROMPT;
  } else {
    // null (기본 분석)
    systemPrompt = ATTRIBUTE_SYSTEM_PROMPT;
  }

  // 검색 기반 분석: 네이버 검색 결과 가져오기
  let searchSources: SearchResult[] = [];
  let searchPromptText = "";
  if (useSearch) {
    const ctx = await searchForIdeas(ideas);
    searchSources = ctx.sources;
    searchPromptText = ctx.promptText;
    if (searchSources.length > 0) console.log("✅ 검색 자료 포함하여 분석합니다.");
  }

  const userPrompt = `다음 아이디어들을 분석해주세요:\n\n${ideasText}${agentInstruction ? "\n\n" + agentInstruction : ""}${userMessageInstruction}${searchPromptText}`;

  // 첨부 파일 처리: 텍스트 파일은 프롬프트에 추가, 이미지는 content block으로
  const textFilesContext = files
    .filter((f) => f.type === "text")
    .map((f) => `\n\n[첨부 파일: ${f.name}]\n${f.content}`)
    .join("");

  const imageBlocks = files
    .filter((f) => f.type === "image" && f.mimeType && f.content)
    .map((f) => {
      // data URL에서 base64 데이터만 추출 (data:image/jpeg;base64,XXXX → XXXX)
      const base64Data = f.content.includes(",") ? f.content.split(",")[1] : f.content;
      const mediaType = (f.mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType,
          data: base64Data,
        },
      };
    });

  const fullTextPrompt = userPrompt + textFilesContext + (textFilesContext ? "\n\n위 첨부 파일 내용도 참고하여 분석해주세요." : "");

  // 이미지가 있으면 content block 배열, 없으면 단순 문자열
  const userContent =
    imageBlocks.length > 0
      ? [
          ...imageBlocks,
          { type: "text" as const, text: fullTextPrompt + "\n\n위 첨부 이미지도 참고하여 분석해주세요." },
        ]
      : fullTextPrompt;

  const message = await getClient().messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // JSON 파싱 시도
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("JSON 형식의 응답을 찾을 수 없습니다.");
  }

  const result = JSON.parse(jsonMatch[0]);
  // agentType이 없으면 요청한 타입으로 강제 주입 (Claude가 빠뜨리는 경우 대비)
  if (agentType && !result.agentType) {
    result.agentType = agentType;
  }
  // 검색 출처가 있으면 결과에 포함
  if (searchSources.length > 0) {
    result.searchSources = searchSources;
  }

  return result;
}

// Pollinations.ai 이미지 생성 (무료, API 키 불필요)
// 백엔드에서 직접 다운로드 후 base64로 변환하여 안정적으로 전달
export async function generateIdeaImage(ideaName: string, ideaContent: string): Promise<string | null> {
  try {
    const prompt = `realistic professional photo of "${ideaName}", ${ideaContent}, modern interior space, natural lighting, people naturally using the space, high quality, no text, no labels`;
    const seed = Math.floor(Math.random() * 9999);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&nologo=true&seed=${seed}&model=turbo`;

    console.log(`🎨 이미지 생성 중: ${ideaName}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(40000) });
    if (!res.ok) {
      console.error(`이미지 생성 실패 (${res.status}):`, ideaName);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/jpeg";
    console.log(`✅ 이미지 완료: ${ideaName} (${(buffer.byteLength / 1024).toFixed(0)}KB)`);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("이미지 생성 오류:", error);
    return null;
  }
}

export async function chatWithAI(
  message: string,
  ideas: IdeaInput[],
  agentType: AgentType = null
): Promise<string> {
  const ideasContext =
    ideas.length > 0
      ? `현재 보드의 아이디어들:\n${ideas
          .map((idea, idx) => `${String.fromCharCode(65 + idx)}. ${idea.title}: ${idea.content}`)
          .join("\n")}\n\n`
      : "";

  // 음성 메시지 여부 감지
  const isVoiceMessage = message.startsWith("🎤 [음성]");
  const voiceInstruction = isVoiceMessage
    ? "\n\n사용자가 음성으로 말한 내용입니다. 보드의 아이디어들과 연관지어 깊이 분석하고, 음성에서 나온 핵심 키워드나 관점을 아이디어 평가에 반영해주세요."
    : "";

  const systemPrompt = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다. 한국어로 답변해주세요.
답변 규칙:
- **절대** 마크다운 사용 금지: **, ##, ---, - 리스트, 번호 목록 전부 사용하지 마세요
- 자연스러운 문장으로만 작성하세요
- 핵심만 2~4문장으로 간결하게
- 항목을 나열할 때는 "첫째", "또한", "마지막으로" 같은 연결어를 쓰세요
- 구어체로 친근하게 말하듯이 작성하세요${voiceInstruction}`;

  const response = await getClient().messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `${ideasContext}${message}`,
      },
    ],
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "응답을 생성할 수 없습니다.";
}
