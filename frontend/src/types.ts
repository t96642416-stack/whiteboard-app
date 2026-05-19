export const IDEA_CATEGORIES = [
  { id: "brainstorm", label: "브레인스토밍", emoji: "🧠", bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  { id: "review",     label: "최종 검토",    emoji: "✅", bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  { id: "candidate",  label: "후보 아이디어", emoji: "💡", bg: "#fef9c3", text: "#854d0e", border: "#fef08a" },
  { id: "other",      label: "기타",         emoji: "📌", bg: "#f3f4f6", text: "#4b5563", border: "#e5e7eb" },
] as const;

export type IdeaCategory = typeof IDEA_CATEGORIES[number]["id"];

export interface IdeaAttachment {
  name: string;
  type: "image" | "file";
  mimeType?: string;
  content: string; // base64 data URL
}

export interface Idea {
  id: string;
  title: string;
  content: string;
  author: string;
  color: string;
  createdAt: string;
  category?: IdeaCategory;
  attachments?: IdeaAttachment[];
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

export interface SearchSource {
  title: string;
  description: string;
  link: string;
}

export interface AnalysisResult {
  ideas: IdeaAnalysis[];
  commonalities: string[];
  differences: string[];
  agentResponse?: string;
  searchSources?: SearchSource[];
}

export type AgentType =
  | "question"
  | "suggestion"
  | "effect"
  | "attribute"
  | "emphasis"
  | "guide"
  | null;

export interface AgentOption {
  type: AgentType;
  emoji: string;
  name: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  userName: string;
  message: string;
  timestamp: string;
  isAI?: boolean;
  isError?: boolean;
  imageUrl?: string; // 이미지 채팅용
  userColor?: string;
}

// 사고전환 질문형 / 사고전환 제안형 공통
export interface PerspectiveAnalysis {
  agentType: 'question' | 'suggestion';
  summary: string;
  currentFocus: string[];
  perspectives: { title: string; description: string }[];
  searchSources?: SearchSource[];
}

// 효과 예측형
export interface EffectAnalysis {
  agentType: 'effect';
  summary: string;
  currentFocus: string[];
  questions: { text: string }[];
  searchSources?: SearchSource[];
}

// 결과 강조형
export interface EmphasisAnalysis {
  agentType: 'emphasis';
  ideas: {
    name: string;
    label: string;
    effects: { label: string; title: string; description: string; note: string }[];
    similarCase: string;
  }[];
  commonalities: string[];
  differences: string[];
  searchSources?: SearchSource[];
}

// 결과 안내형
export interface GuideAnalysis {
  agentType: 'guide';
  recommendedIdea: string;
  recommendReason: string;
  ideas: { name: string; feasibility: number; userExperience: number; uniqueness: number }[];
  limitNote: string;
  searchSources?: SearchSource[];
}

export type AgentAnalysisResult = PerspectiveAnalysis | EffectAnalysis | EmphasisAnalysis | GuideAnalysis;

export const AGENT_OPTIONS: AgentOption[] = [
  {
    type: "question",
    emoji: "🔄",
    name: "사고전환 질문형",
    description: "고정관념을 깨는 질문으로 새 시각 유도",
  },
  {
    type: "suggestion",
    emoji: "💡",
    name: "사고전환 제안형",
    description: "다른 관점의 아이디어 제안",
  },
  {
    type: "effect",
    emoji: "📊",
    name: "효과 예측형",
    description: "아이디어 실행 시 예상 효과 분석",
  },
  {
    type: "attribute",
    emoji: "🔍",
    name: "속성 분석형",
    description: "아이디어의 세부 속성을 깊이 분석",
  },
  {
    type: "emphasis",
    emoji: "✨",
    name: "결과 강조형",
    description: "가장 긍정적 결과를 강조",
  },
  {
    type: "guide",
    emoji: "📋",
    name: "결과 안내형",
    description: "다음 단계 행동 가이드 제시",
  },
];

export interface AnalysisFile {
  name: string;
  type: "text" | "image";
  mimeType?: string;
  content: string; // text content 또는 base64 data URL
}

export interface AnalysisHistoryItem {
  id: string;
  agentType: AgentType;
  requester: string;
  timestamp: string;
  result: AnalysisResult | null;
  agentResult: AgentAnalysisResult | null;
}

export const CARD_COLORS = [
  "#fef9c3", // 노란
  "#fce7f3", // 분홍
  "#dcfce7", // 초록
  "#e0f2fe", // 하늘
  "#ede9fe", // 보라
  "#fff7ed", // 오렌지
];

export const IDEA_BADGE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: "#fef9c3", text: "#854d0e" },
  1: { bg: "#dcfce7", text: "#166534" },
  2: { bg: "#dbeafe", text: "#1e40af" },
  3: { bg: "#ede9fe", text: "#5b21b6" },
  4: { bg: "#fce7f3", text: "#9d174d" },
  5: { bg: "#fff7ed", text: "#9a3412" },
};
