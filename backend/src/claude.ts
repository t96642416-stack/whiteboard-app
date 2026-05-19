import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";

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
  | null;

// attribute용 기존 형식 유지
const ATTRIBUTE_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
사용자의 아이디어를 분석하여 장단점, 공통점, 차이점을 한국어로 정리해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "ideas": [
    {
      "id": "아이디어 ID",
      "name": "아이디어 이름",
      "pros": [{"point": "장점", "evidence": "근거나 데이터"}],
      "cons": [{"point": "단점", "evidence": "근거나 우려사항"}]
    }
  ],
  "commonalities": ["공통점1", "공통점2"],
  "differences": ["차이점1", "차이점2"],
  "agentResponse": "에이전트 응답 (해당하는 경우)"
}`;

const QUESTION_SUGGESTION_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 분석하여 현재 논의에서 빠진 관점을 파악하고 한국어로 정리해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "question",
  "summary": "현재 논의 요약 2-3문장",
  "currentFocus": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "perspectives": [
    {"title": "빠진 관점 제목", "description": "설명 1-2문장"},
    {"title": "빠진 관점 제목", "description": "설명"},
    {"title": "빠진 관점 제목", "description": "설명"}
  ]
}`;

const EFFECT_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
아이디어들을 분석하여 사고를 전환하는 질문들을 제시해주세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "effect",
  "summary": "현재 논의 요약",
  "currentFocus": ["키워드1", "키워드2"],
  "questions": [
    {"text": "사고를 전환하는 질문 1"},
    {"text": "질문 2"},
    {"text": "질문 3"}
  ]
}`;

const EMPHASIS_SYSTEM_PROMPT = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다.
각 아이디어의 예상 효과를 구체적인 수치와 함께 분석하고, 공통점과 차이점도 정리해주세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "emphasis",
  "ideas": [
    {
      "name": "아이디어 이름",
      "label": "아이디어 A",
      "effects": [
        {"label": "예상효과 1", "title": "소음 충돌 54% 감소↓", "description": "설명", "note": "근거"},
        {"label": "예상효과 2", "title": "재이용 의향 81% 증가↑", "description": "설명", "note": "근거"}
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

export async function analyzeIdeas(
  ideas: IdeaInput[],
  agentType: AgentType = null,
  userMessage: string = "",
  files: AnalysisFile[] = []
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

  if (agentType === "question" || agentType === "suggestion") {
    systemPrompt = QUESTION_SUGGESTION_SYSTEM_PROMPT;
    if (agentType === "suggestion") {
      systemPrompt = systemPrompt.replace('"agentType": "question"', '"agentType": "suggestion"');
    }
  } else if (agentType === "effect") {
    systemPrompt = EFFECT_SYSTEM_PROMPT;
  } else if (agentType === "emphasis") {
    systemPrompt = EMPHASIS_SYSTEM_PROMPT;
  } else if (agentType === "guide") {
    systemPrompt = GUIDE_SYSTEM_PROMPT;
  } else {
    // attribute or null
    systemPrompt = ATTRIBUTE_SYSTEM_PROMPT;
    agentInstruction = agentType ? "각 아이디어의 비용/시간/난이도/영향도를 점수(1-10)로 분석해주세요. JSON의 agentResponse 필드에 문자열로 포함시켜주세요." : "";
  }

  const userPrompt = `다음 아이디어들을 분석해주세요:\n\n${ideasText}${agentInstruction ? "\n\n" + agentInstruction : ""}${userMessageInstruction}`;

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
  return result;
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

  const systemPrompt = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다. 한국어로 답변해주세요.${voiceInstruction}`;

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
