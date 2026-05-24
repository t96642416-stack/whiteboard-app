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

export interface IdeaAttachment {
  name: string;
  type: "image" | "file";
  mimeType?: string;
  content: string; // base64 data URL
}

export interface IdeaInput {
  id: string;
  title: string;
  content: string;
  author: string;
  attachments?: IdeaAttachment[];
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
const ATTRIBUTE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
아래에 주어진 아이디어 목록을 평가하세요. 절대 새로운 아이디어를 추가하거나 생성하지 마세요.
주어진 아이디어들의 장단점만 분석합니다. 첨부 파일(전사지, 근거자료)이 있으면 그 내용을 근거로 활용하세요.
한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "attribute",
  "ideas": [
    {
      "id": "아이디어 ID",
      "name": "아이디어 이름",
      "pros": [
        {"point": "핵심 장점", "evidence": "근거 (첨부파일·전사지 인용 또는 일반 근거)"},
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
  "agentResponse": "위 아이디어들 중 어떤 기준을 가장 중요하게 볼 것인지 팀이 합의해야 할 것 같아요. 어떤 기준이 이 공간에서 가장 중요할까요?"
}`;

// 관점 제시형 (suggestion) - 빠진 관점 카드
const PERSPECTIVE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들과 첨부 파일(전사지, 근거자료)을 바탕으로, 현재 논의에서 팀이 놓치고 있는 관점을 짚어주세요.
새 아이디어를 제안하는 것이 아니라, 기존 아이디어를 더 깊이 검토할 수 있는 시각을 제시하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "suggestion",
  "summary": "현재 논의와 첨부 자료 요약 2-3문장",
  "currentFocus": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "perspectives": [
    {"title": "놓친 관점 제목", "description": "기존 아이디어에 이 관점을 적용하면 어떤 점이 달라지는지 설명"},
    {"title": "놓친 관점 제목", "description": "설명"},
    {"title": "놓친 관점 제목", "description": "설명"}
  ]
}`;

// 관점 탐색형 (question) - Q1/Q2/Q3 탐색 질문
const EXPLORE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들과 첨부 파일(전사지, 근거자료)을 바탕으로, 팀이 아직 충분히 검토하지 않은 부분을 파고드는 질문을 만들어주세요.
새 아이디어를 제안하는 것이 아니라, 기존 아이디어의 가정·리스크·실현 조건 등을 검증하는 질문이어야 합니다. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "question",
  "summary": "현재 논의와 첨부 자료 요약 2-3문장",
  "currentFocus": ["키워드1", "키워드2", "키워드3"],
  "questions": [
    {"text": "기존 아이디어에 대한 검증 질문 1 (물음표로 끝나는 질문형)"},
    {"text": "검증 질문 2"},
    {"text": "검증 질문 3"}
  ]
}`;

const EFFECT_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들을 실행했을 때의 예상 효과를 분석해주세요. 새 아이디어 제안은 하지 마세요.
첨부 파일(전사지, 근거자료)이 있으면 그 내용을 근거로 활용하세요. 서술형으로 작성하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "effect",
  "summary": "아이디어들과 첨부 자료의 전체 방향 요약",
  "currentFocus": ["핵심 키워드1", "핵심 키워드2"],
  "questions": [
    {"text": "아이디어 A 실행 시: ~할 것이다 형태로 서술"},
    {"text": "아이디어 B 실행 시: ~로 이어질 것이다 형태로 서술"},
    {"text": "공통 예상 효과 또는 리스크"},
    {"text": "첨부 자료 기반 추가 인사이트"}
  ]
}`;

const EMPHASIS_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들의 예상 효과를 분석하세요. 새 아이디어를 추가하지 마세요.
첨부 파일(전사지, 근거자료)이 있으면 그 데이터·사례를 근거로 활용하세요. 한국어로 작성하세요.

효과 title 작성 규칙:
- 첨부 자료나 실제 연구에 근거한 수치가 있을 때만 "54% 감소↓" 같은 수치를 포함하세요.
- 근거 없이 수치를 만들지 마세요. 근거 없으면 서술형으로 쓰세요.
- note 필드에는 출처나 유사 사례를 적으세요. 없으면 빈 문자열("")로 두세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "emphasis",
  "ideas": [
    {
      "name": "아이디어 이름",
      "label": "아이디어 A",
      "effects": [
        {"label": "예상효과 1", "title": "소음 충돌 감소 효과", "description": "설명 (첨부 자료 근거 포함)", "note": "출처 또는 빈 문자열"},
        {"label": "예상효과 2", "title": "이용자 만족도 향상", "description": "설명", "note": ""}
      ],
      "similarCase": "첨부 자료나 실제 사례 기반 유사 사례 설명"
    }
  ],
  "commonalities": ["공통점1", "공통점2"],
  "differences": ["차이점1", "차이점2"]
}`;

const GUIDE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들을 실현 가능성, 사용자 편의, 주제 차별성 기준으로 0-100 점수로 평가하고 최적 아이디어를 추천하세요.
새 아이디어를 생성하지 마세요. 주어진 아이디어만 평가하세요. 첨부 파일(전사지, 근거자료)이 있으면 그 내용을 근거로 활용하세요. 한국어로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "guide",
  "recommendedIdea": "추천 아이디어 이름 (주어진 것 중에서)",
  "recommendReason": "추천 이유 1-2문장 (첨부 자료 근거 포함)",
  "ideas": [
    {"name": "아이디어 A 이름", "feasibility": 80, "userExperience": 55, "uniqueness": 20},
    {"name": "아이디어 B 이름", "feasibility": 66, "userExperience": 88, "uniqueness": 75}
  ],
  "limitNote": "분석 한계 또는 추가 검토 필요 사항"
}`;

const ADVISE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들을 실현 가능성, 사용자 편의, 차별성 기준으로 비교하세요. 새 아이디어를 생성하지 마세요.
첨부 파일(전사지, 근거자료)이 있으면 근거로 활용하고, 팀이 스스로 기준을 선택할 수 있도록 질문형 코멘트로 마무리하세요. 한국어로 작성하세요.

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
  "recommendation": "첨부 자료 기반으로 차별성을 우선한다면 B안, 실현 가능성을 우선한다면 A안이 적합해요. 팀이 가장 중요하게 생각하는 기준이 무엇인가요?",
  "limitNote": "분석 한계 또는 추가 검토 필요 사항"
}`;

export async function analyzeIdeas(
  ideas: IdeaInput[],
  agentType: AgentType = null,
  userMessage: string = "",
  files: AnalysisFile[] = [],
  useSearch: boolean = false
): Promise<AnalysisResult | Record<string, unknown>> {
  // 아이디어도 없고 파일도 없으면 빈 결과 반환
  if (ideas.length === 0 && files.length === 0) {
    return {
      ideas: [],
      commonalities: [],
      differences: [],
    };
  }

  const ideasText = ideas.length === 0
    ? "첨부된 파일을 기반으로 분석해주세요. 아이디어 카드는 없습니다."
    : ideas
        .map((idea, idx) => {
          const label = String.fromCharCode(65 + idx);
          let text = `아이디어 ${label} (ID: ${idea.id})\n제목: ${idea.title}\n내용: ${idea.content}\n작성자: ${idea.author}`;
          if (idea.attachments && idea.attachments.length > 0) {
            const imageCount = idea.attachments.filter(a => a.type === "image").length;
            if (imageCount > 0) text += `\n첨부 이미지: ${imageCount}개 (아래 이미지 참조)`;

            // 텍스트 계열 파일: base64 디코딩 후 내용 포함
            const TEXT_MIMES = ["text/plain", "text/csv", "text/markdown", "text/html", "application/json", "text/javascript"];
            const TEXT_EXTS = [".txt", ".md", ".csv", ".json", ".tsv", ".log"];
            idea.attachments.filter(a => a.type === "file").forEach(a => {
              const isTextMime = TEXT_MIMES.some(m => (a.mimeType || "").startsWith(m));
              const isTextExt = TEXT_EXTS.some(e => a.name.toLowerCase().endsWith(e));
              if (isTextMime || isTextExt) {
                try {
                  const base64 = a.content.includes(",") ? a.content.split(",")[1] : a.content;
                  const decoded = Buffer.from(base64, "base64").toString("utf-8").slice(0, 3000);
                  text += `\n\n[첨부 파일: ${a.name}]\n${decoded}`;
                } catch { /* 디코딩 실패 시 무시 */ }
              } else if ((a.mimeType || "").toLowerCase() === "application/pdf" || a.name.toLowerCase().endsWith(".pdf")) {
                // PDF는 document 블록으로 별도 전달 → 여기서는 참조 메모만
                text += `\n첨부 PDF: ${a.name} (아래 문서 블록 참조)`;
              } else {
                text += `\n첨부 파일: ${a.name}`;
              }
            });
          }
          return text;
        })
        .join("\n\n");

  // 아이디어 카드에 첨부된 이미지 / PDF vision blocks
  type ValidMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const VALID_MEDIA_TYPES: ValidMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  type IdeaBlock =
    | { type: "image"; source: { type: "base64"; media_type: ValidMediaType; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };
  const ideaImageBlocks: IdeaBlock[] = [];
  ideas.forEach((idea) => {
    if (!idea.attachments) return;
    idea.attachments.forEach(a => {
      if (!a.content) return;
      const base64Data = a.content.includes(",") ? a.content.split(",")[1] : a.content;
      const mime = (a.mimeType || "").toLowerCase();

      if (a.type === "image") {
        const rawMime = mime || "image/jpeg";
        const mediaType: ValidMediaType = VALID_MEDIA_TYPES.includes(rawMime as ValidMediaType)
          ? rawMime as ValidMediaType : "image/jpeg";
        ideaImageBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
      } else if (a.type === "file" && (mime === "application/pdf" || a.name.toLowerCase().endsWith(".pdf"))) {
        // PDF는 document 블록으로 직접 전달 → Claude가 내용 읽음
        ideaImageBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } });
      }
    });
  });

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

  // 아이디어가 3개 이상이면 그룹화 분석 지시
  const groupingInstruction = ideas.length >= 3
    ? `\n\n[중요] 아이디어가 ${ideas.length}개입니다. 개별 아이디어를 하나하나 분석하지 말고, 먼저 의미적으로 관련된 아이디어들을 테마 그룹(안)으로 묶어서 분석하세요. ideas 배열의 각 항목이 하나의 안(案/그룹)을 나타내도록 하세요. 예: "A안 (학습 공간 개선)" vs "B안 (식사 공간 개선)" 처럼 2~4개의 그룹으로 수렴하세요. 그룹 이름에 포함된 아이디어들을 간략히 명시하세요.`
    : "";

  const userPrompt = `다음 아이디어들을 분석해주세요:\n\n${ideasText}${groupingInstruction}${agentInstruction ? "\n\n" + agentInstruction : ""}${userMessageInstruction}${searchPromptText}`;

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

  // 모든 이미지 블록 합산 (분석용 파일 + 아이디어 카드 첨부 이미지)
  const allImageBlocks = [...ideaImageBlocks, ...imageBlocks];
  const hasImages = allImageBlocks.length > 0;
  const imageNote = hasImages
    ? `\n\n위 첨부 파일(이미지/PDF 포함)의 내용도 분석에 반영해주세요.`
    : "";

  // 이미지가 있으면 content block 배열, 없으면 단순 문자열
  const userContent = hasImages
    ? [
        ...allImageBlocks,
        { type: "text" as const, text: fullTextPrompt + imageNote },
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

// Pollinations.ai 이미지 URL 생성 (다운로드 없이 URL만 반환, 브라우저가 직접 로드)
export function generateIdeaImage(ideaName: string, ideaContent: string, topic?: string): string {
  // 주제 + 아이디어를 결합해서 구체적인 적용 이미지 생성
  const contextPart = topic
    ? `${topic} space with "${ideaName}" concept applied`
    : `"${ideaName}" concept applied`;
  const prompt = `realistic professional interior photo showing ${contextPart}: ${ideaContent}, modern design, natural lighting, people naturally using the space, photorealistic, no text, no labels`;
  const seed = Math.floor(Math.random() * 9999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&nologo=true&seed=${seed}&model=flux`;
}

export async function chatWithAI(
  message: string,
  ideas: IdeaInput[],
  agentType: AgentType = null,
  contextIdea: { title: string; content: string } | null = null
): Promise<string> {
  // 특정 카드가 선택된 경우 → 참고용 컨텍스트로 사용
  const ideasContext = contextIdea
    ? `사용자가 선택한 아이디어:\n제목: ${contextIdea.title}\n내용: ${contextIdea.content || "(내용 없음)"}\n\n`
    : ideas.length > 0
      ? `현재 보드의 아이디어들:\n${ideas
          .map((idea, idx) => `${String.fromCharCode(65 + idx)}. ${idea.title}: ${idea.content}`)
          .join("\n")}\n\n`
      : "";

  // 음성 메시지 여부 감지
  const isVoiceMessage = message.startsWith("🎤 [음성]");
  const voiceInstruction = isVoiceMessage
    ? "\n\n사용자가 음성으로 말한 내용입니다. 선택된 아이디어와 연관지어 분석해주세요."
    : "";

  const contextInstruction = contextIdea
    ? `\n- 사용자가 특정 아이디어 카드를 선택했습니다. 그 아이디어를 중심으로 질문에 답해주세요. A안/B안처럼 비교 분석하지 말고, 선택한 아이디어에 대해 참고·조언 형식으로 자연스럽게 답변하세요.`
    : "";

  const systemPrompt = `당신은 창의적 사고를 돕는 AI 퍼실리테이터입니다. 한국어로 답변해주세요.
답변 규칙:
- **절대** 마크다운 사용 금지: **, ##, ---, - 리스트, 번호 목록 전부 사용하지 마세요
- 자연스러운 문장으로만 작성하세요
- 핵심만 2~4문장으로 간결하게
- 항목을 나열할 때는 "첫째", "또한", "마지막으로" 같은 연결어를 쓰세요
- 구어체로 친근하게 말하듯이 작성하세요${contextInstruction}${voiceInstruction}`;

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
