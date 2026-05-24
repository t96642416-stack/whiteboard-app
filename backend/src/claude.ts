import Anthropic from "@anthropic-ai/sdk";
import { searchForIdeas, SearchResult } from "./search";

// Claude 클라이언트
function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Gemini REST API 직접 호출 (SDK 없이) — 429 시 retryDelay만큼 대기 후 1회 재시도
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 없음");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };

  const doRequest = () => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let res = await doRequest();

  // 429 rate limit → retryDelay 파싱 후 대기, 1회 재시도
  if (res.status === 429) {
    const errText = await res.text();
    let waitMs = 20000; // 기본 20초
    try {
      const errJson = JSON.parse(errText);
      const retryInfo = errJson?.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"));
      if (retryInfo?.retryDelay) {
        const seconds = parseInt(retryInfo.retryDelay.replace("s", ""), 10);
        if (!isNaN(seconds)) waitMs = (seconds + 1) * 1000;
      }
    } catch { /* 파싱 실패 시 기본값 사용 */ }
    console.log(`⏳ Gemini 429 rate limit → ${waitMs / 1000}초 대기 후 재시도...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    res = await doRequest();
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
  role?: "idea" | "reference"; // idea: 아이디어 파일, reference: 전사지/참고자료
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

// 공통 근거 규칙 (모든 프롬프트에 적용)
const EVIDENCE_RULE = `
[근거 작성 필수 규칙 — 반드시 지켜야 함]
- 전사지는 맥락 파악 전용입니다. 근거로 인용하지 마세요.
- 근거는 아이디어 파일 내용에서 가져오세요.
1. 아이디어 파일에 관련 문장이 있으면 원문을 직접 인용하세요. 파일명은 쓰지 마세요.
   형식: "원문 그대로 발췌" → 해석/의미
   예시: "카페처럼 자유롭게 대화할 수 있는 공간이 필요하다" → 소음 허용 공간 분리가 핵심임을 보여줌
2. 아이디어 파일에 없는 근거는 반드시 "추가 근거: "를 앞에 붙이고, 끝에 출처·분야·연도를 괄호로 표기하세요. 파일 없음 언급은 하지 마세요.
   형식: 추가 근거: 내용 (출처 또는 분야, 연도)
   예시: 추가 근거: 수면 공간은 장시간 점유로 회전율 저하 가능성 (국내 공간 운영 사례, 2023)
   예시: 추가 근거: 소음 분리 공간 도입 후 이용자 만족도 상승 (공간 디자인 연구, 2021)
3. 출처 없는 평서문, 파일 내용 없이 만들어낸 문장은 엄격히 금지합니다.`;

// attribute용 - 장단점 2열 비교 분석
const ATTRIBUTE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
아래에 주어진 아이디어 목록을 평가하세요. 절대 새로운 아이디어를 추가하거나 생성하지 마세요.
주어진 아이디어들의 장단점만 분석합니다. 전사지가 있으면 아이디어가 도출된 논의 흐름과 맥락을 파악하여 분석에 반영하세요.
한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.
${EVIDENCE_RULE}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "attribute",
  "ideas": [
    {
      "id": "아이디어 ID",
      "name": "아이디어 이름",
      "pros": [
        {"point": "핵심 장점 (15자 이내)", "evidence": "\"아이디어 파일 원문 인용\" → 해석, 또는 추가 근거: ..."},
        {"point": "장점 2", "evidence": "\"아이디어 파일 원문 인용\" → 해석, 또는 추가 근거: ..."}
      ],
      "cons": [
        {"point": "핵심 단점 (15자 이내)", "evidence": "\"아이디어 파일 원문 인용\" → 해석, 또는 추가 근거: ..."},
        {"point": "단점 2", "evidence": "\"아이디어 파일 원문 인용\" → 해석, 또는 추가 근거: ..."}
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
새 아이디어를 제안하는 것이 아니라, 기존 아이디어를 더 깊이 검토할 수 있는 시각을 제시하세요. 한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.
${EVIDENCE_RULE}

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
새 아이디어를 제안하는 것이 아니라, 기존 아이디어의 가정·리스크·실현 조건 등을 검증하는 질문이어야 합니다. 한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.
${EVIDENCE_RULE}

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
전사지가 있으면 아이디어가 도출된 논의 흐름과 맥락을 파악하여 분석에 반영하세요. 서술형으로 작성하세요. 한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.
${EVIDENCE_RULE}

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
전사지/파일이 있으면 반드시 실제 내용을 인용해서 분석에 반영하세요. 한국어로 작성하세요.
${EVIDENCE_RULE}

추가 필드 규칙:
- title: 효과 이름 (15자 이내 간결한 명사형). 첨부 자료에 수치가 있을 때만 수치 포함. 없으면 서술형.
- description: 반드시 [파일명]: "원문 인용" → 해석 형식 또는 "추가 근거: ..." 형식으로만 작성. 출처 없는 평서문 금지.
- note: 파일에 언급된 유사 사례나 출처. 없으면 빈 문자열("").
- similarCase: 파일/전사지에서 직접 언급된 유사 사례만. 없으면 "추가 근거: " 접두어 붙인 일반 사례.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 반환하세요:
{
  "agentType": "emphasis",
  "ideas": [
    {
      "name": "아이디어 이름",
      "label": "아이디어 A",
      "effects": [
        {"label": "예상효과 1", "title": "소음 갈등 완화", "description": "\"소음 관련 민원 2021년 68건 → 2024년 156건\" → 소셜존 지정으로 역방향 감소 기대", "note": ""},
        {"label": "예상효과 2", "title": "협업 공간 확보", "description": "추가 근거: 그룹 활동 전용 공간은 팀 커뮤니케이션 효율을 높임", "note": ""}
      ],
      "similarCase": "추가 근거: 대학 도서관의 그룹 스터디룸 분리 운영 사례는 소음 갈등 감소에 효과적"
    }
  ],
  "commonalities": ["공통점1", "공통점2"],
  "differences": ["차이점1", "차이점2"]
}`;

const GUIDE_SYSTEM_PROMPT = `당신은 팀의 의사결정을 돕는 AI 퍼실리테이터입니다.
주어진 아이디어들을 실현 가능성, 사용자 편의, 주제 차별성 기준으로 0-100 점수로 평가하고 최적 아이디어를 추천하세요.
새 아이디어를 생성하지 마세요. 주어진 아이디어만 평가하세요. 전사지가 있으면 아이디어가 도출된 논의 흐름과 맥락을 파악하여 분석에 반영하세요. 한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.

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
전사지가 있으면 아이디어가 도출된 논의 흐름과 맥락을 파악하여 분석에 반영하고, 팀이 스스로 기준을 선택할 수 있도록 질문형 코멘트로 마무리하세요. 한국어로 작성하세요. 모든 설명은 한 문장(30자 이내)으로 간결하게 작성하세요.

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
  useSearch: boolean = false,
  sectionGroups?: { title: string; ideaIds: string[] }[]
): Promise<AnalysisResult | Record<string, unknown>> {
  // 아이디어도 없고 파일도 없으면 빈 결과 반환
  if (ideas.length === 0 && files.length === 0) {
    return {
      ideas: [],
      commonalities: [],
      differences: [],
    };
  }

  // 섹션 그룹핑이 있으면 섹션을 "안(案)" 단위로 포맷
  const hasSectionGroups = sectionGroups && sectionGroups.length > 0;
  const ideasText = hasSectionGroups
    ? sectionGroups!.map((group, idx) => {
        const label = String.fromCharCode(65 + idx) + "안";
        const groupIdeas = ideas.filter(i => group.ideaIds.includes(i.id));
        const subContent = groupIdeas.length > 0
          ? groupIdeas.map(i => `  - ${i.title}${i.content ? ": " + i.content : ""}`).join("\n")
          : "  (세부 아이디어 없음)";
        return `${label} (${group.title})\n${subContent}`;
      }).join("\n\n")
    : ideas.length === 0
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

  // 그룹화 분석 지시
  const groupingInstruction = hasSectionGroups
    ? `\n\n[중요] 위 내용은 팀이 직접 섹션으로 구분한 안(案)들입니다. ${sectionGroups!.map((g, i) => `${String.fromCharCode(65+i)}안: ${g.title}`).join(", ")}. 각 안을 하나의 분석 단위로 사용하세요. ideas 배열의 각 항목이 각 안(섹션)을 나타내도록 하세요.`
    : ideas.length >= 3
    ? `\n\n[중요] 아이디어가 ${ideas.length}개입니다. 개별 아이디어를 하나하나 분석하지 말고, 의미적으로 관련된 아이디어들을 테마 그룹(안)으로 묶어서 분석하세요. 2~4개의 그룹으로 수렴하세요.`
    : "";

  const userPrompt = `다음 아이디어들을 분석해주세요:\n\n${ideasText}${groupingInstruction}${agentInstruction ? "\n\n" + agentInstruction : ""}${userMessageInstruction}${searchPromptText}`;

  // 첨부 파일 처리: role별로 구분
  // role="idea" → 각 파일이 하나의 아이디어 안(案)
  // role="reference" → 전사지/참고자료 (아이디어로 착각하면 안 됨)
  // role 없는 기존 파일 → 참고자료로 처리
  const ideaFiles = files.filter((f) => f.role === "idea");
  const referenceFiles = files.filter((f) => f.role !== "idea");

  // 아이디어 파일: 3000자 초과분은 잘라냄 (비용 0)
  const IDEA_FILE_LIMIT = 3000;
  const trimmedIdeaFiles = ideaFiles.filter(f => f.type === "text").map((f, idx) => ({
    label: String.fromCharCode(65 + idx) + "안",
    name: f.name,
    text: f.content.length > IDEA_FILE_LIMIT
      ? f.content.slice(0, IDEA_FILE_LIMIT) + "\n...(이하 생략)"
      : f.content,
  }));

  const ideaFilesText = trimmedIdeaFiles.length > 0
    ? "\n\n[파일 기반 아이디어 안(案)들 — 아래 각 파일이 하나의 아이디어 안(案)입니다. 각 파일의 내용을 분석 대상으로 삼되, 파일 안의 문장을 직접 인용하여 근거로 활용하세요. 인용 형식: [파일명]: \"원문\" → 해석]\n" +
      trimmedIdeaFiles.map((f) => `\n--- ${f.label}: ${f.name} ---\n${f.text}`).join("")
    : "";

  // 전사지: 4000자 초과분은 잘라냄 (비용 0)
  const TRANSCRIPT_LIMIT = 4000;
  const refTextFiles = referenceFiles.filter(f => f.type === "text");
  const trimmedRefs = refTextFiles.map((f) => ({
    name: f.name,
    text: f.content.length > TRANSCRIPT_LIMIT
      ? f.content.slice(0, TRANSCRIPT_LIMIT) + "\n...(이하 생략)"
      : f.content,
  }));

  const referenceFilesText = trimmedRefs.length > 0
    ? "\n\n[전사지 / 논의 원본 — 맥락 파악 전용. 아이디어가 어떤 흐름에서 나왔는지 이해하는 데만 사용하세요. 전사지 내용을 근거로 직접 인용하지 마세요. 근거는 반드시 아이디어 파일에서만 가져오세요.]\n" +
      trimmedRefs.map((r) => `\n--- 전사지: ${r.name} ---\n${r.text}`).join("")
    : "";

  const textFilesContext = ideaFilesText + referenceFilesText;

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

  const fullTextPrompt = userPrompt + textFilesContext + (textFilesContext ? "\n\n위 파일들을 참고하여 분석해주세요." : "");

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

  let responseText = "";

  // 이미지 없으면 Gemini 우선 시도, 실패 시 Claude fallback
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log(`[분석] 이미지 첨부: ${hasImages}, GEMINI_API_KEY: ${geminiKey ? "✓ (길이:" + geminiKey.length + ")" : "✗ 없음"}`);
  if (!hasImages && geminiKey) {
    try {
      responseText = await callGemini(systemPrompt, fullTextPrompt);
      console.log("✅ Gemini로 분석 완료");
    } catch (e: any) {
      console.warn("⚠️ Gemini 실패, Claude로 fallback:", e?.message || e);
    }
  }

  // Gemini 미사용 or 실패 시 Claude
  if (!responseText) {
    const message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });
    responseText = message.content[0].type === "text" ? message.content[0].text : "";
    console.log("✅ Claude sonnet으로 분석 완료");
  }

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
    model: "claude-sonnet-4-5",
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
