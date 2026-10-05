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
  layout?: "three" | "single" | "scan";
  scanner?: { title: string; description: string; camera: boolean; upload: boolean };
  quick: QuickQuestion[];
  deep: DeepQuestion[];
  profiles: Record<string, QuizProfile>;
  mappings: ProductMapping[];
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
