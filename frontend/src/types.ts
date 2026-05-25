export const IDEA_CATEGORIES = [
  { id: "brainstorm", label: "브레인스토밍", emoji: "🧠", bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  { id: "ai",         label: "AI 피드백",    emoji: "🤖", bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
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

export interface IdeaComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface AnalysisSnapshot {
  agentType: string;  // 'suggestion' | 'question' | 'emphasis' | 'attribute' | 'guide' | 'advise'
  itemData: any;      // 각 아이템 원본 데이터
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
  comments?: IdeaComment[];
  analysisSnapshot?: AnalysisSnapshot;  // AI 결과 카드용 스냅샷
  aiImageUrl?: string;  // AI 분석에서 적용된 예상 이미지 URL
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
  | "advise"
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

// 관점 제시형 (suggestion)
export interface PerspectiveAnalysis {
  agentType: 'suggestion';
  summary: string;
  currentFocus: string[];
  perspectives: { title: string; description: string }[];
  searchSources?: SearchSource[];
}

// 관점 탐색형 (question) - Q1/Q2/Q3 탐색 질문
export interface QuestionAnalysis {
  agentType: 'question';
  summary: string;
  currentFocus: string[];
  questions: { text: string }[];
  searchSources?: SearchSource[];
}

// 효과 예측형 (effect) - 레거시, 내부적으로만 사용
export interface EffectAnalysis {
  agentType: 'effect';
  summary: string;
  currentFocus: string[];
  questions: { text: string }[];
  searchSources?: SearchSource[];
}

// 속성 분석형 (attribute) - 장점/단점 2열 비교
export interface AttributeAnalysis {
  agentType: 'attribute';
  ideas: {
    id: string;
    name: string;
    pros: { point: string; evidence: string }[];
    cons: { point: string; evidence: string }[];
    imageUrl?: string;
  }[];
  commonalities: string[];
  differences: string[];
  agentResponse?: string;
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
    imageUrl?: string;
  }[];
  commonalities: string[];
  differences: string[];
  searchSources?: SearchSource[];
}

// 결과 추천형 (구 결과 안내형)
export interface GuideAnalysis {
  agentType: 'guide';
  recommendedIdea: string;
  recommendReason: string;
  ideas: {
    name: string;
    feasibility: number; feasibilityReason?: string;
    userExperience: number; userExperienceReason?: string;
    uniqueness: number; uniquenessReason?: string;
  }[];
  limitNote: string;
  searchSources?: SearchSource[];
}

// 결과 안내형 (기준별 비교)
export interface AdviseAnalysis {
  agentType: 'advise';
  criteriaResults: { criterion: string; winner: string }[];
  ideas: {
    name: string;
    feasibility: number; feasibilityReason?: string;
    userExperience: number; userExperienceReason?: string;
    uniqueness: number; uniquenessReason?: string;
  }[];
  recommendation: string;
  limitNote?: string;
  searchSources?: SearchSource[];
}

export type AgentAnalysisResult = PerspectiveAnalysis | QuestionAnalysis | EffectAnalysis | AttributeAnalysis | EmphasisAnalysis | GuideAnalysis | AdviseAnalysis;

export const AGENT_OPTIONS: AgentOption[] = [
  {
    type: "suggestion",
    emoji: "💡",
    name: "관점 제시형",
    description: "빠진 관점을 찾아 새 시각 제안",
  },
  {
    type: "question",
    emoji: "🔍",
    name: "관점 탐색형",
    description: "새로운 시각을 여는 탐색 질문",
  },
  {
    type: "emphasis",
    emoji: "📊",
    name: "효과 예측형",
    description: "아이디어 실행 시 예상 효과 분석",
  },
  {
    type: "attribute",
    emoji: "🔬",
    name: "속성 분석형",
    description: "아이디어의 장단점을 깊이 분석",
  },
  {
    type: "guide",
    emoji: "⭐",
    name: "결과 강조형",
    description: "점수 기반으로 최적 아이디어 추천",
  },
  {
    type: "advise",
    emoji: "📋",
    name: "결과 안내형",
    description: "기준별 비교로 팀 결정을 안내",
  },
];

export interface AnalysisFile {
  name: string;
  type: "text" | "image";
  mimeType?: string;
  content: string; // text content 또는 base64 data URL
  role?: "idea" | "reference"; // idea: 아이디어 파일, reference: 전사지/참고자료
}

export interface AnalysisHistoryItem {
  id: string;
  dbId?: number;
  agentType: AgentType;
  requester: string;
  timestamp: string;
  result: AnalysisResult | null;
  agentResult: AgentAnalysisResult | null;
}

export interface BoardSection {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasImage {
  id: string;
  src: string; // base64 data URL
  x: number;
  y: number;
  width: number;
  height: number;
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
