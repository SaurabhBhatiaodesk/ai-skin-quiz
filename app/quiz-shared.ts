export type ResultTag = "vata" | "pitta" | "kapha" | "balanced";
export type QuickOption = { value: string; label: string; hint: string; tag?: ResultTag; tags?: string[] };
export type QuickQuestion = {
  phase: string;
  text: string;
  sub: string;
  options: QuickOption[];
  continueLabel?: string;
  multiple?: boolean;
  skip?: boolean;
  image?: string;
};
export type DeepOption = { label: string; hint: string; scores: Record<string, number>; tag?: ResultTag; tags?: string[] };
export type DeepQuestion = {
  layer: number;
  phase: string;
  text: string;
  sub: string;
  options: DeepOption[];
  continueLabel?: string;
  multiple?: boolean;
  skip?: boolean;
  image?: string;
};
export type QuizProfile = {
  name: string;
  sub: string;
  essence: string;
  insight: string;
  heroClass: string;
  modal: string;
  products: string[];
};
export type ProductMapping = { id: string; tags: string[]; productHandle: string; grouping?: "and" | "or"; variantId?: string };
export type StoredQuiz = {
  resultMode?: "personalized" | "products";
  emailCapture?: { enabled: boolean; heading: string; button: string; allowSkip: boolean };
  widgetCss?: string;
  enabledPaths?: Array<"quick" | "deep" | "scan">;
  singleFlow?: "quick" | "deep";
  cardIcons?: Partial<Record<"scan" | "quick" | "deep", string>>;
  coverImage?: string;
  profileImage?: string;
  layout?: "three" | "single" | "scan";
  scanner?: { title: string; description: string; camera: boolean; upload: boolean };
  scanIntegration?: { provider: string; endpoint: string; documentation: string };
  design?: { backBg?: string; backText?: string; backBorder?: string; answerPadding?: number; mobileAnswerPadding?: number; scanCard?: string; scanText?: string; scanHeading?: string; scanButton?: string; scanButtonText?: string; headingColor?: string; cardColor?: string; answerColor?: string; answerText?: string; selectedColor?: string; selectedText?: string; headingSize?: number; questionSize?: number; bodySize?: number; answerSize?: number; buttonSize?: number; desktopWidth?: number; desktopPadding?: number; mobileWidth?: number; mobilePadding?: number; mobileHeadingSize?: number; mobileQuestionSize?: number; mobileAnswerSize?: number; answerSpacing?: number; mobileAnswerSpacing?: number; desktopButtonWidth?: number; mobileButtonWidth?: number; desktopButtonHeight?: number; mobileButtonHeight?: number; mobileButtonSize?: number; buttonAlignment?: "left" | "center" | "right"; background: string; text: string; accent: string; buttonText: string; font: "classic" | "sans"; radius: "square" | "rounded" | "pill" };
  quick: QuickQuestion[];
  deep: DeepQuestion[];
  profiles: Record<string, QuizProfile>;
  mappings: ProductMapping[];
};

export const recommendedQuizDesign: Omit<Required<NonNullable<StoredQuiz["design"]>>, "scanCard" | "scanText" | "scanHeading" | "scanButton" | "scanButtonText" | "backBg" | "backText" | "backBorder"> = {
  answerPadding: 12,
  mobileAnswerPadding: 12,
  headingColor: "#000000",
  cardColor: "#f3e5cc",
  answerColor: "#e4c3a0",
  answerText: "#471326",
  selectedColor: "#571c29",
  selectedText: "#ffffff",
  headingSize: 36,
  questionSize: 26,
  bodySize: 15,
  answerSize: 18,
  buttonSize: 18,
  desktopWidth: 960,
  desktopPadding: 36,
  mobileWidth: 100,
  mobilePadding: 24,
  mobileHeadingSize: 28,
  mobileQuestionSize: 20,
  mobileAnswerSize: 18,
  answerSpacing: 14,
  mobileAnswerSpacing: 14,
  desktopButtonWidth: 22,
  mobileButtonWidth: 60,
  desktopButtonHeight: 48,
  mobileButtonHeight: 44,
  mobileButtonSize: 16,
  buttonAlignment: "center",
  background: "#f4f6f2",
  text: "#471326",
  accent: "#471326",
  buttonText: "#ffffff",
  font: "classic",
  radius: "rounded",
};

export type ShopProduct = {
  title: string;
  handle: string;
  tags: string[];
  productType: string;
  image: string;
  price: string;
  variants?: Array<{ id: string; title: string; price: string; image: string }>;
};

export function slugTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function scoresForTag(tag: string, layer = 1) {
  const current = layer === 2;
  if (tag === "vata") return current ? { Vv: 3 } : { V: 3 };
  if (tag === "pitta") return current ? { Pv: 3 } : { P: 3 };
  if (tag === "kapha") return current ? { Kv: 3 } : { K: 3 };
  return {};
}

export const LAYOUT_NAMES: Record<string, string> = { three: "Combined Quiz", single: "Single Quiz", scan: "AI Skin Scan" };
