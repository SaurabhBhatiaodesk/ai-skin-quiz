import prisma from "./db.server";
import { DEEP_SPEC_QUESTIONS, DOSHA_CONTENT, RITUAL_PRODUCTS, FREQUENCY_LABELS, doshaFromCounts, doshaGuide, type DoshaGuide, type DoshaResultKey } from "./dosha-content";
import defaultWidgetCss from "./storefront-quiz.css?raw";
import scanCardIcon from "../public/images/onboarding/scan.svg?raw";
import deepCardIcon from "../public/images/onboarding/dosha.svg?raw";
import quickCardIcon from "../public/images/onboarding/quiz.svg?raw";
import { recommendedQuizDesign, scoresForTag, slugTag, WIDGET_TEXT_KEYS, REQUIRED_TEXT_KEYS, DEFAULT_QUIZ_COLORS, DEFAULT_SCAN_COLORS } from "./quiz-shared";
import type {
  DeepQuestion,
  ProductMapping,
  QuickQuestion,
  QuizProfile,
  ResultTag,
  ShopProduct,
  StoredQuiz,
} from "./quiz-shared";

export { scoresForTag, slugTag };
export const DEFAULT_CARD_ICONS = {
  scan: `data:image/svg+xml;base64,${Buffer.from(scanCardIcon).toString("base64")}`,
  quick: `data:image/svg+xml;base64,${Buffer.from(quickCardIcon).toString("base64")}`,
  deep: `data:image/svg+xml;base64,${Buffer.from(deepCardIcon).toString("base64")}`,
} as const;
export type {
  DeepOption,
  DeepQuestion,
  ProductMapping,
  QuickOption,
  QuickQuestion,
  QuizProfile,
  ResultTag,
  ShopProduct,
  StoredQuiz,
} from "./quiz-shared";

export type QuizProduct = {
  variantId?: string;
  title: string;
  price: string;
  image: string;
  handle: string;
  why: string;
  // Scan results: which observed concerns this product was matched to.
  concerns?: string[];
};
export type QuizResult = {
  // Deep Dosha results: the spec's full reading (signature, signs, ritual, usage guide).
  guide?: DoshaGuide;
  resultMode?: "personalized" | "products";
  scanAreas?: Array<{concern: string; observation: string; regions: string[]; intensity: string}>;
  percentages?: Record<string, number>;
  dosha: string;
  source: string;
  showUpgrade: boolean;
  insight: string;
  profile: QuizProfile;
  markers: Record<string, { score: number; label: string }> | null;
  products: QuizProduct[];
};

const PROFILES: Record<string, QuizProfile> = {
  vata: {
    name: "Vata",
    sub: "Air & Space · The energy of movement",
    heroClass: "rh-vata",
    modal: "vata",
    essence: "Your skin carries the poetry of movement — alive, expressive, and deeply sensitive to the world around it.",
    insight: "Your skin is <em>Vata-dominant</em> — fine-pored, delicate, and expressive. It thrives with richness and consistency. When balanced, it has a translucent, almost porcelain quality. Your ritual is built around sustained nourishment and barrier protection.",
    products: ["saffron-glow-serum", "saffron-radiance-moisturizer", "bakuchiol-night-serum", "rose-jasmine-milk-cleanser"],
  },
  pitta: {
    name: "Pitta",
    sub: "Fire & Water · The energy of transformation",
    heroClass: "rh-pitta",
    modal: "pitta",
    essence: "Luminous when calm, reactive when pushed — your skin reflects your inner fire with precision and immediacy.",
    insight: "Your skin is <em>Pitta-dominant</em> — warm, luminous, and intelligent. It responds quickly to stress and heat, showing redness, pigmentation, and sensitivity as signals. Your ritual is built around cooling, calming anti-inflammatory intelligence.",
    products: ["rose-jasmine-milk-cleanser", "rose-water-toning-mist", "turmeric-sandalwood-mask", "bakuchiol-night-serum"],
  },
  kapha: {
    name: "Kapha",
    sub: "Earth & Water · The energy of structure",
    heroClass: "rh-kapha",
    modal: "kapha",
    essence: "Built for the long game — Kapha skin ages slowly and beautifully when it's given clarity and movement.",
    insight: "Your skin is <em>Kapha-dominant</em> — thick, stable, and slow to age. The challenge is circulation: congestion, enlarged pores, and dullness. Your ritual is built around deep cleansing, clay, and brightening botanicals.",
    products: ["rose-jasmine-milk-cleanser", "turmeric-sandalwood-mask", "saffron-glow-serum", "rose-water-toning-mist"],
  },
  "dual-vata-pitta": {
    name: "Vata–Pitta",
    sub: "Air, Space & Fire · The creative flame",
    heroClass: "rh-vata",
    modal: "dual-vata-pitta",
    essence: "The artist's constitution — quick, radiant, reactive. Your skin is full of life and full of opinions.",
    insight: "Your skin is <em>Vata–Pitta dual dominant</em> — combining Vata's delicacy with Pitta's reactivity. Your ritual bridges both: soothing the fire while feeding the air.",
    products: ["rose-jasmine-milk-cleanser", "rose-water-toning-mist", "bakuchiol-night-serum", "saffron-glow-serum"],
  },
  "dual-vata-kapha": {
    name: "Vata–Kapha",
    sub: "Air, Space & Earth · Grounded movement",
    heroClass: "rh-vata",
    modal: "dual-vata-kapha",
    essence: "The nurturer's constitution — resilient and sensitive. Your skin alternates between thirst and congestion.",
    insight: "Your skin is <em>Vata–Kapha dual dominant</em> — sometimes dry and delicate, sometimes congested and dull. Your products need to do both without compromising either.",
    products: ["rose-jasmine-milk-cleanser", "turmeric-sandalwood-mask", "saffron-radiance-moisturizer", "saffron-glow-serum"],
  },
  "dual-kapha-pitta": {
    name: "Kapha–Pitta",
    sub: "Earth, Water & Fire · Powerful radiance",
    heroClass: "rh-pitta",
    modal: "dual-kapha-pitta",
    essence: "Resilient and radiant — your skin has extraordinary capacity when it's working in harmony.",
    insight: "Your skin is <em>Kapha–Pitta dual dominant</em> — combining Kapha's structure with Pitta's intensity. Your ritual focuses on purifying clarity and cooling.",
    products: ["rose-jasmine-milk-cleanser", "turmeric-sandalwood-mask", "rose-water-toning-mist", "saffron-glow-serum"],
  },
  balanced: {
    name: "Tridoshic",
    sub: "Vata · Pitta · Kapha · In balance",
    heroClass: "rh-pitta",
    modal: "tridoshic",
    essence: "The rarest constitution — all three energies in relative harmony. Your ritual is about maintenance, not correction.",
    insight: "Your skin reads as <em>Tridoshic</em> — all three doshas in relative balance. This is the rarest and most resilient skin constitution. Your ritual focus is seasonal maintenance.",
    products: ["rose-jasmine-milk-cleanser", "rose-water-toning-mist", "saffron-glow-serum", "bakuchiol-night-serum"],
  },
};

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    phase: "Skin type",
    text: "How does your skin feel most days?",
    sub: "Think about your baseline — not during a breakout or right after a holiday.",
    options: [
      { value: "vata", label: "Dry or very dry", hint: "Tight, flaky, thirsty" },
      { value: "kapha", label: "Oily or combination", hint: "Shiny by midday, pores visible" },
      { value: "pitta", label: "Sensitive or reactive", hint: "Flushes easily, redness" },
      { value: "balanced", label: "Normal or balanced", hint: "Generally comfortable" },
    ],
  },
  {
    phase: "Primary concern",
    text: "What's your number one skin concern?",
    sub: "The thing you think about most when you look in the mirror.",
    options: [
      { value: "dullness", label: "Dullness or no glow", hint: "Skin looks tired, flat" },
      { value: "aging", label: "Fine lines or firmness", hint: "Loss of elasticity" },
      { value: "pigmentation", label: "Dark spots or uneven tone", hint: "Hyperpigmentation" },
      { value: "texture", label: "Breakouts or texture", hint: "Congestion, enlarged pores" },
    ],
  },
  {
    phase: "Ritual moment",
    text: "When do you want to transform your skin most?",
    sub: "Your ritual anchor — this shapes which products matter most.",
    options: [
      { value: "morning", label: "Morning — quick, protective", hint: "Prep for the day" },
      { value: "night", label: "Night — slow, restorative", hint: "Deep repair while you sleep" },
      { value: "weekly", label: "Weekly reset", hint: "One ritual that resets everything" },
      { value: "full", label: "Full ritual — morning & night", hint: "The complete system" },
    ],
  },
];

// The PRANA spec's 18 questions (A = Vata, B = Pitta, C = Kapha).
export const DEEP_QUESTIONS: DeepQuestion[] = DEEP_SPEC_QUESTIONS.map((question) => ({ ...question, options: question.options.map((option) => ({ ...option })) }));

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function uiFields(question: { continueLabel?: string; multiple?: unknown; skip?: unknown; image?: string }) {
  const fields: { continueLabel?: string; multiple?: boolean; skip?: boolean; image?: string } = {};
  const label = clip(question.continueLabel, 40);
  const image = clip(question.image, 500);
  if (label) fields.continueLabel = label;
  if (image.startsWith("https://") || image.startsWith("http://")) fields.image = image;
  if (question.multiple === true) fields.multiple = true;
  if (question.skip === true) fields.skip = true;
  return fields;
}

export function cleanTags(value: unknown, label: string) {
  const raw = Array.isArray(value) ? value : [];
  const tags = raw.map((item) => slugTag(String(item))).filter(Boolean);
  if (!tags.length) tags.push(slugTag(label) || "tag");
  return [...new Set(tags)].slice(0, 8);
}

function doshaFromTags(tags: string[]): ResultTag | null {
  const found = tags.find((tag) => tag === "vata" || tag === "pitta" || tag === "kapha" || tag === "balanced");
  return found || null;
}

export function asTag(value: unknown, fallback: ResultTag = "balanced"): ResultTag {
  const tag = clip(value, 40).toLowerCase();
  if (tag === "vata" || tag === "pitta" || tag === "kapha" || tag === "balanced") return tag;
  if (tag === "aging") return "vata";
  if (tag === "pigmentation") return "pitta";
  if (tag === "texture") return "kapha";
  return fallback;
}

export function tagFromScores(scores: Record<string, number>): ResultTag {
  const vata = (scores.V || 0) + (scores.Vv || 0);
  const pitta = (scores.P || 0) + (scores.Pv || 0);
  const kapha = (scores.K || 0) + (scores.Kv || 0);
  const max = Math.max(vata, pitta, kapha);
  if (max <= 0) return "balanced";
  if (vata === max) return "vata";
  if (pitta === max) return "pitta";
  return "kapha";
}

function resultFromTags(tags: string[]) {
  const counts = { vata: 0, pitta: 0, kapha: 0 };
  tags.forEach((tag) => {
    const clean = asTag(tag);
    if (clean !== "balanced") counts[clean] += 1;
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] === 0) return "balanced";
  if (ranked[0][1] === ranked[2][1]) return "balanced";
  if (ranked[0][1] === ranked[1][1]) {
    const pair = [ranked[0][0], ranked[1][0]].sort().join("-");
    if (pair === "pitta-vata") return "dual-vata-pitta";
    if (pair === "kapha-vata") return "dual-vata-kapha";
    return "dual-kapha-pitta";
  }
  return ranked[0][0];
}

function normalizeScores(value: unknown) {
  const scores: Record<string, number> = {};
  if (!value || typeof value !== "object") return scores;
  for (const key of ["V", "P", "K", "Vv", "Pv", "Kv"]) {
    const amount = Number((value as Record<string, unknown>)[key]);
    if (Number.isFinite(amount) && amount > 0 && amount <= 20) scores[key] = amount;
  }
  return scores;
}

function normalizeProfiles(value: unknown) {
  const incoming = value && typeof value === "object" ? (value as Record<string, QuizProfile>) : {};
  const profiles: Record<string, QuizProfile> = {};
  for (const [key, fallback] of Object.entries(PROFILES)) {
    const source = incoming[key] || fallback;
    const products = Array.isArray(source.products)
      ? source.products.map((handle) => clip(handle, 120)).filter(Boolean).slice(0, 6)
      : fallback.products;
    profiles[key] = {
      name: clip(source.name, 80) || fallback.name,
      sub: clip(source.sub, 180) || fallback.sub,
      essence: clip(source.essence, 500) || fallback.essence,
      insight: clip(source.insight, 900) || fallback.insight,
      heroClass: fallback.heroClass,
      modal: fallback.modal,
      products,
    };
  }
  return profiles;
}

// Drafts (new or not yet finished quizzes) may be stored without questions; saves from the editor are strict.
// Matches the default stylesheet header, including copies saved with a mis-encoded dash.
const DEFAULT_CSS_MARKER = /^\/\* AI Dosha Quiz \S+ storefront styles\./;

export function normalizeQuiz(input: unknown, { draft = false }: { draft?: boolean } = {}): StoredQuiz {
  const source = input && typeof input === "object" ? (input as { layout?: unknown; quick?: unknown; deep?: unknown; profiles?: unknown; mappings?: unknown }) : {};
  const layout = source.layout === "scan" ? "scan" : source.layout === "single" ? "single" : "three";
  const options = input as StoredQuiz;
  const singleFlow = options?.singleFlow === "deep" ? "deep" as const : "quick" as const;
  const allowed = ["quick", "deep", "scan"] as const;
  const enabledPaths = layout === "scan" ? ["scan" as const] : layout === "single" ? [singleFlow] : Array.isArray(options?.enabledPaths) ? allowed.filter(path => options.enabledPaths!.includes(path)) : [...allowed];
  if (!enabledPaths.length || (layout === "three" && enabledPaths.length < 2)) throw new Error("Choose at least two paths for a combined quiz.");
  const imageUrl = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return "";
    let url: URL | null = null;
    try { url = new URL(value); } catch { url = null; }
    if (!url || url.protocol !== "https:") {
      if (draft) return "";
      throw new Error("Use an HTTPS image URL.");
    }
    return url.href.slice(0, 1500);
  };
  const cardIcons: Partial<Record<"scan" | "quick" | "deep", string>> = {};
  for (const path of ["scan", "quick", "deep"] as const) {
    const value = options?.cardIcons?.[path];
    if (!value) continue;
    if (typeof value === "string" && value.length <= 90000 && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) cardIcons[path] = value;
    else if (typeof value === "string" && value.length <= 1500 && value.startsWith("https://")) cardIcons[path] = imageUrl(value);
    else if (!draft) throw new Error("Use an SVG, PNG, JPG or WebP icon under 64 KB, or an HTTPS image URL.");
  }
  const coverImage = imageUrl(options?.coverImage);
  const profileImage = imageUrl(options?.profileImage);
  const quick = (Array.isArray(source.quick) ? source.quick : []).slice(0, layout === "single" ? 40 : 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const question = item as QuickQuestion;
    const text = clip(question.text, 300);
    const options = (Array.isArray(question.options) ? question.options : []).slice(0, 8).flatMap((option) => {
      if (!option || typeof option !== "object") return [];
      const label = clip(option.label, 160);
      if (!label) return [];
      const tags = cleanTags(option.tags, label);
      const tag = doshaFromTags(tags) || asTag(option.tag || option.value);
      return [{ value: tag, label, hint: clip(option.hint, 160), tag, tags }];
    });
    if (!text || options.length < 2) return [];
    return [{ phase: clip(question.phase, 80) || "Question", text, sub: clip(question.sub, 240), options, ...uiFields(question) }];
  });
  const deep = (Array.isArray(source.deep) ? source.deep : []).slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const question = item as DeepQuestion;
    const text = clip(question.text, 300);
    const layer = [1, 2, 3].includes(Number(question.layer)) ? Number(question.layer) : 1;
    const options = (Array.isArray(question.options) ? question.options : []).slice(0, 8).flatMap((option) => {
      if (!option || typeof option !== "object") return [];
      const label = clip(option.label, 200);
      if (!label) return [];
      const scores = normalizeScores(option.scores);
      const tags = cleanTags(option.tags, label);
      const tag = doshaFromTags(tags) || asTag(option.tag, tagFromScores(scores));
      return [{ label, hint: clip(option.hint, 160), scores, tag, tags }];
    });
    if (!text || options.length < 2) return [];
    return [{ layer, phase: clip(question.phase, 80) || "Question", text, sub: clip(question.sub, 240), options, ...uiFields(question) }];
  });
  if (!draft && layout === "single" && !(singleFlow === "deep" ? deep.length : quick.length)) {
    throw new Error("Add at least one question with two answers.");
  }
  if (!draft && layout === "three" && ((enabledPaths.includes("quick") && !quick.length) || (enabledPaths.includes("deep") && !deep.length))) {
    throw new Error("Add at least one quick question and one deep question, each with two answers.");
  }
  const scan = (input as StoredQuiz)?.scanner;
  const scanner = {
    title: !scan?.title || scan.title === "AI Skin Scan" ? "Skin Insights" : clip(scan.title, 80),
    description: !scan?.description || ["Skin scan analysis is not configured. Try the question quiz.", "Try the skin scan demo with a live camera or photo upload."].includes(scan.description) ? "Use a camera or upload a photo for cosmetic skin observations." : clip(scan.description, 240),
    camera: scan?.camera !== false,
    upload: scan?.upload !== false,
  };
  if (!scanner.camera && !scanner.upload) throw new Error("Enable camera or photo upload for Skin Scan.");
  // A widget without any saved design (new install, new quiz) starts with the default colours as well.
  const suppliedDesign: StoredQuiz["design"] = (input as StoredQuiz)?.design ?? ((input as StoredQuiz)?.layout === "scan" ? DEFAULT_SCAN_COLORS : DEFAULT_QUIZ_COLORS) as StoredQuiz["design"];
  const colorLabels: Record<string, string> = { scanToggleBg: "Camera/upload toggle background", scanToggleActive: "Toggle selected background", scanUploadBg: "Upload box background", scanUploadBorder: "Upload box border color", scanHint: "Hint line color (below the photo)", scanStepIdle: "Inactive steps color", scanDivider: "Divider line color", scanNoticeText: "Notice text color", scanBoxBorder: "Consent box border color", scanLabel: "Consent text color", scanAccent: "Steps and checkbox color", scanNoticeBg: "Notice background", scanBoxBg: "Consent box background", entryIconBg: "Icon background color", entryTitleColor: "Card title color", entryTextColor: "Card text color", entryTimeColor: "Time line color", entryGhost: "Outline button color", brandColor: "Brand line color", titleColor: "Title color", subtitleColor: "Subtitle color", entryBg: "Card background", entryBorder: "Card border color", entryFeatured: "Featured card color", headingAccent: "Highlight word color", backBg: "Back button background", backText: "Back button text color", backBorder: "Back button border color", scanCard: "Skin Scan card background", scanText: "Skin Scan text color", scanHeading: "Skin Scan heading color", scanButton: "Skin Scan button background", scanButtonText: "Skin Scan button text", headingColor: "Question heading color", cardColor: "Question card background", answerColor: "Answer background", answerText: "Answer text color", selectedColor: "Selected answer background", selectedText: "Selected answer text", background: "Background color", text: "Body text color", accent: "Button background", buttonText: "Button text color" };
  // Accepts #RGB, #RRGGBB and #RRGGBBAA (alpha dropped) with stray spaces; empty values use the default.
  function color(value: unknown, fallback: string, field = "") {
    if (value === undefined || value === null || value === "") return fallback;
    const raw = typeof value === "string" ? value.trim().replace(/^([0-9a-f]{6}|[0-9a-f]{8})$/i, "#$1") : "";
    const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const hex = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : /^#[0-9a-f]{8}$/i.test(raw) ? raw.slice(0, 7) : raw;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`${colorLabels[field] || "A color"} must be a hex color like #1A2921.`);
    return hex;
  }
  function fontSize(value: unknown, fallback: number) {
    if (value === undefined) return fallback;
    const size = Number(value);
    if (!Number.isFinite(size) || size < 10 || size > 64) throw new Error("Font sizes must be between 10 and 64 px.");
    return size;
  }
  const design: NonNullable<StoredQuiz["design"]> = {
    // Skin Scan colours for this widget's scan screen; empty means "same as the quiz".
    ...Object.fromEntries((["scanCard", "scanText", "scanHeading", "scanButton", "scanButtonText", "backBg", "backText", "backBorder", "headingAccent", "entryBg", "entryBorder", "entryFeatured", "brandColor", "titleColor", "subtitleColor", "entryTitleColor", "entryTextColor", "entryTimeColor", "entryGhost", "entryIconBg", "scanAccent", "scanNoticeBg", "scanBoxBg", "scanToggleBg", "scanToggleActive", "scanUploadBg", "scanUploadBorder", "scanHint", "scanStepIdle", "scanDivider", "scanNoticeText", "scanBoxBorder", "scanLabel"] as const).flatMap(key => { const value = suppliedDesign?.[key]; return value ? [[key, color(value, "", key)]] : []; })),
    headingColor: color(suppliedDesign?.headingColor, recommendedQuizDesign.headingColor, "headingColor"),
    cardColor: color(suppliedDesign?.cardColor, recommendedQuizDesign.cardColor, "cardColor"),
    answerColor: color(suppliedDesign?.answerColor, recommendedQuizDesign.answerColor, "answerColor"),
    answerText: color(suppliedDesign?.answerText, recommendedQuizDesign.answerText, "answerText"),
    selectedColor: color(suppliedDesign?.selectedColor, recommendedQuizDesign.selectedColor, "selectedColor"),
    selectedText: color(suppliedDesign?.selectedText, recommendedQuizDesign.selectedText, "selectedText"),
    headingSize: fontSize(suppliedDesign?.headingSize, recommendedQuizDesign.headingSize),
    questionSize: fontSize(suppliedDesign?.questionSize, recommendedQuizDesign.questionSize),
    bodySize: fontSize(suppliedDesign?.bodySize, recommendedQuizDesign.bodySize),
    answerSize: fontSize(suppliedDesign?.answerSize, recommendedQuizDesign.answerSize),
    buttonSize: fontSize(suppliedDesign?.buttonSize, recommendedQuizDesign.buttonSize),

    background: color(suppliedDesign?.background, recommendedQuizDesign.background, "background"), text: color(suppliedDesign?.text, recommendedQuizDesign.text, "text"),
    accent: color(suppliedDesign?.accent, recommendedQuizDesign.accent, "accent"), buttonText: color(suppliedDesign?.buttonText, recommendedQuizDesign.buttonText, "buttonText"),
    font: suppliedDesign?.font === "sans" ? "sans" : recommendedQuizDesign.font,
    desktopWidth: Math.min(1800, Math.max(320, Number.isFinite(Number(suppliedDesign?.desktopWidth)) ? Number(suppliedDesign?.desktopWidth) : 960)),
    desktopPadding: Math.min(100, Math.max(0, Number.isFinite(Number(suppliedDesign?.desktopPadding)) ? Number(suppliedDesign?.desktopPadding) : 36)),
    mobileWidth: Math.min(100, Math.max(60, Number.isFinite(Number(suppliedDesign?.mobileWidth)) ? Number(suppliedDesign?.mobileWidth) : 100)),
    mobilePadding: Math.min(48, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobilePadding)) ? Number(suppliedDesign?.mobilePadding) : 24)),
    scanTitleSize: Math.min(48, Math.max(14, Number.isFinite(Number(suppliedDesign?.scanTitleSize)) ? Number(suppliedDesign?.scanTitleSize) : 26)),
    mobileScanTitleSize: Math.min(40, Math.max(14, Number.isFinite(Number(suppliedDesign?.mobileScanTitleSize)) ? Number(suppliedDesign?.mobileScanTitleSize) : 22)),
    scanTextSize: Math.min(22, Math.max(10, Number.isFinite(Number(suppliedDesign?.scanTextSize)) ? Number(suppliedDesign?.scanTextSize) : 15)),
    mobileScanTextSize: Math.min(20, Math.max(10, Number.isFinite(Number(suppliedDesign?.mobileScanTextSize)) ? Number(suppliedDesign?.mobileScanTextSize) : 14)),
    scanUploadHeight: Math.min(600, Math.max(120, Number.isFinite(Number(suppliedDesign?.scanUploadHeight)) ? Number(suppliedDesign?.scanUploadHeight) : 240)),
    mobileScanUploadHeight: Math.min(500, Math.max(100, Number.isFinite(Number(suppliedDesign?.mobileScanUploadHeight)) ? Number(suppliedDesign?.mobileScanUploadHeight) : 200)),
    scanNoticeSize: Math.min(20, Math.max(10, Number.isFinite(Number(suppliedDesign?.scanNoticeSize)) ? Number(suppliedDesign?.scanNoticeSize) : 13)),
    mobileScanNoticeSize: Math.min(18, Math.max(10, Number.isFinite(Number(suppliedDesign?.mobileScanNoticeSize)) ? Number(suppliedDesign?.mobileScanNoticeSize) : 12)),
    headerTop: Math.min(120, Math.max(0, Number.isFinite(Number(suppliedDesign?.headerTop)) ? Number(suppliedDesign?.headerTop) : 40)),
    mobileHeaderTop: Math.min(80, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileHeaderTop)) ? Number(suppliedDesign?.mobileHeaderTop) : 24)),
    headerGap: Math.min(120, Math.max(0, Number.isFinite(Number(suppliedDesign?.headerGap)) ? Number(suppliedDesign?.headerGap) : 40)),
    mobileHeaderGap: Math.min(80, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileHeaderGap)) ? Number(suppliedDesign?.mobileHeaderGap) : 24)),
    entryTimeSize: Math.min(20, Math.max(8, Number.isFinite(Number(suppliedDesign?.entryTimeSize)) ? Number(suppliedDesign?.entryTimeSize) : 11)),
    mobileEntryTimeSize: Math.min(18, Math.max(8, Number.isFinite(Number(suppliedDesign?.mobileEntryTimeSize)) ? Number(suppliedDesign?.mobileEntryTimeSize) : 10)),
    entryIconSize: Math.min(180, Math.max(40, Number.isFinite(Number(suppliedDesign?.entryIconSize)) ? Number(suppliedDesign?.entryIconSize) : 109)),
    mobileEntryIconSize: Math.min(160, Math.max(40, Number.isFinite(Number(suppliedDesign?.mobileEntryIconSize)) ? Number(suppliedDesign?.mobileEntryIconSize) : 80)),
    entryTitleSize: Math.min(48, Math.max(14, Number.isFinite(Number(suppliedDesign?.entryTitleSize)) ? Number(suppliedDesign?.entryTitleSize) : 24)),
    mobileEntryTitleSize: Math.min(40, Math.max(14, Number.isFinite(Number(suppliedDesign?.mobileEntryTitleSize)) ? Number(suppliedDesign?.mobileEntryTitleSize) : 24)),
    entryTextSize: Math.min(24, Math.max(10, Number.isFinite(Number(suppliedDesign?.entryTextSize)) ? Number(suppliedDesign?.entryTextSize) : 16)),
    mobileEntryTextSize: Math.min(22, Math.max(10, Number.isFinite(Number(suppliedDesign?.mobileEntryTextSize)) ? Number(suppliedDesign?.mobileEntryTextSize) : 14)),
    entryPadding: Math.min(64, Math.max(8, Number.isFinite(Number(suppliedDesign?.entryPadding)) ? Number(suppliedDesign?.entryPadding) : 30)),
    mobileEntryPadding: Math.min(48, Math.max(8, Number.isFinite(Number(suppliedDesign?.mobileEntryPadding)) ? Number(suppliedDesign?.mobileEntryPadding) : 22)),
    entryGap: Math.min(60, Math.max(0, Number.isFinite(Number(suppliedDesign?.entryGap)) ? Number(suppliedDesign?.entryGap) : 26)),
    mobileEntryGap: Math.min(40, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileEntryGap)) ? Number(suppliedDesign?.mobileEntryGap) : 16)),
    entryRadius: Math.min(48, Math.max(0, Number.isFinite(Number(suppliedDesign?.entryRadius)) ? Number(suppliedDesign?.entryRadius) : 14)),
    questionGap: Math.min(80, Math.max(0, Number.isFinite(Number(suppliedDesign?.questionGap)) ? Number(suppliedDesign?.questionGap) : 28)),
    mobileQuestionGap: Math.min(60, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileQuestionGap)) ? Number(suppliedDesign?.mobileQuestionGap) : 20)),
    buttonGap: Math.min(80, Math.max(0, Number.isFinite(Number(suppliedDesign?.buttonGap)) ? Number(suppliedDesign?.buttonGap) : 28)),
    mobileButtonGap: Math.min(60, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileButtonGap)) ? Number(suppliedDesign?.mobileButtonGap) : 24)),
    brandSize: Math.min(24, Math.max(8, Number.isFinite(Number(suppliedDesign?.brandSize)) ? Number(suppliedDesign?.brandSize) : 11)),
    mobileBrandSize: Math.min(20, Math.max(8, Number.isFinite(Number(suppliedDesign?.mobileBrandSize)) ? Number(suppliedDesign?.mobileBrandSize) : 10)),
    mobileSubtitleSize: Math.min(24, Math.max(10, Number.isFinite(Number(suppliedDesign?.mobileSubtitleSize)) ? Number(suppliedDesign?.mobileSubtitleSize) : 13)),
    mobileHeadingSize: Math.min(48, Math.max(14, Number.isFinite(Number(suppliedDesign?.mobileHeadingSize)) ? Number(suppliedDesign?.mobileHeadingSize) : 28)),
    mobileQuestionSize: Math.min(48, Math.max(14, Number.isFinite(Number(suppliedDesign?.mobileQuestionSize)) ? Number(suppliedDesign?.mobileQuestionSize) : 20)),
    mobileAnswerSize: Math.min(32, Math.max(12, Number.isFinite(Number(suppliedDesign?.mobileAnswerSize)) ? Number(suppliedDesign?.mobileAnswerSize) : 14)),
    answerSpacing: Math.min(40, Math.max(0, Number.isFinite(Number(suppliedDesign?.answerSpacing)) ? Number(suppliedDesign?.answerSpacing) : 14)),
    // Top/bottom padding inside each answer (no fixed minimum height).
    answerPadding: Math.min(40, Math.max(0, Number.isFinite(Number(suppliedDesign?.answerPadding)) ? Number(suppliedDesign?.answerPadding) : 12)),
    mobileAnswerPadding: Math.min(40, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileAnswerPadding)) ? Number(suppliedDesign?.mobileAnswerPadding) : 12)),
    mobileAnswerSpacing: Math.min(32, Math.max(0, Number.isFinite(Number(suppliedDesign?.mobileAnswerSpacing)) ? Number(suppliedDesign?.mobileAnswerSpacing) : 14)),
    desktopButtonWidth: Math.min(100, Math.max(20, Number.isFinite(Number(suppliedDesign?.desktopButtonWidth)) ? Number(suppliedDesign?.desktopButtonWidth) : 22)),
    mobileButtonWidth: Math.min(100, Math.max(20, Number.isFinite(Number(suppliedDesign?.mobileButtonWidth)) ? Number(suppliedDesign?.mobileButtonWidth) : 60)),
    desktopButtonHeight: Math.min(80, Math.max(32, Number.isFinite(Number(suppliedDesign?.desktopButtonHeight)) ? Number(suppliedDesign?.desktopButtonHeight) : 48)),
    mobileButtonHeight: Math.min(80, Math.max(32, Number.isFinite(Number(suppliedDesign?.mobileButtonHeight)) ? Number(suppliedDesign?.mobileButtonHeight) : 44)),
    mobileButtonSize: Math.min(32, Math.max(10, Number.isFinite(Number(suppliedDesign?.mobileButtonSize)) ? Number(suppliedDesign?.mobileButtonSize) : 16)),
    buttonAlignment: suppliedDesign?.buttonAlignment === "left" ? "left" : suppliedDesign?.buttonAlignment === "right" ? "right" : "center",
    radius: suppliedDesign?.radius === "square" ? "square" : suppliedDesign?.radius === "pill" ? "pill" : recommendedQuizDesign.radius,
  };
  const suppliedIntegration = (input as StoredQuiz)?.scanIntegration;
  const scanIntegration = { provider: clip(suppliedIntegration?.provider, 80), endpoint: clip(suppliedIntegration?.endpoint, 500), documentation: clip(suppliedIntegration?.documentation, 500) };
  for (const value of [scanIntegration.endpoint, scanIntegration.documentation]) {
    if (value) {
      let url: URL;
      try { url = new URL(value); } catch { throw new Error("Use a valid HTTPS URL for the scan provider."); }
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use HTTPS URLs without embedded credentials.");
    }
  }
  const suppliedTexts = (input as StoredQuiz)?.texts;
  const texts = Object.fromEntries(WIDGET_TEXT_KEYS.flatMap(key => { const value = suppliedTexts?.[key]; return typeof value === "string" && value.trim() ? [[key, value.trim().slice(0, 240)]] : []; }));
  const suppliedHidden = (input as StoredQuiz)?.hiddenTexts;
  const hiddenTexts = Array.isArray(suppliedHidden) ? WIDGET_TEXT_KEYS.filter(key => suppliedHidden.includes(key) && !REQUIRED_TEXT_KEYS.includes(key)) : [];
  const suppliedCss = (input as StoredQuiz)?.widgetCss;
  if (suppliedCss !== undefined && (typeof suppliedCss !== "string" || suppliedCss.length > 100000)) throw new Error("Widget CSS must be text under 100,000 characters.");
  // Widget CSS holds custom overrides only. Older saves stored a full copy of the default stylesheet,
  // which would freeze the widget on outdated styles, so those copies are dropped.
  const widgetCss = typeof suppliedCss === "string" && !DEFAULT_CSS_MARKER.test(suppliedCss.trimStart()) ? suppliedCss : undefined;
  const email = (input as StoredQuiz)?.emailCapture;
  const emailCapture = { enabled: email?.enabled === true, heading: clip(email?.heading, 120) || "Where should we send your ritual?", button: clip(email?.button, 40) || "See my ritual", allowSkip: email?.allowSkip !== false };
  return { texts, hiddenTexts, resultMode: (input as StoredQuiz)?.resultMode === "products" ? "products" : "personalized", cardIcons, emailCapture, enabledPaths, singleFlow, coverImage, profileImage, widgetCss, layout, scanner, design, scanIntegration, quick: enabledPaths.includes("quick") ? quick : [], deep: enabledPaths.includes("deep") ? deep : [], profiles: normalizeProfiles(source.profiles), mappings: normalizeMappings(source.mappings) };
}

function normalizeMappings(value: unknown): ProductMapping[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const mapping = item as ProductMapping;
    const tags = (Array.isArray(mapping.tags) ? mapping.tags : []).map((tag) => slugTag(String(tag))).filter(Boolean).slice(0, 12);
    const productHandle = clip(mapping.productHandle, 120);
    if (!tags.length || !productHandle) return [];
    const grouping = mapping.grouping === "and" ? "and" as const : "or" as const;
    const variantId = clip(mapping.variantId, 100);
    if (variantId && !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variantId)) return [];
    return [{ id: clip(mapping.id, 40) || `${tags[0]}-${productHandle}`, tags: [...new Set(tags)], productHandle, grouping, ...(variantId ? { variantId } : {}) }];
  });
}

function assertHasQuestions(quiz: StoredQuiz) {
  const paths = quiz.enabledPaths || [];
  const missing = paths.some(path => (path === "quick" && !quiz.quick.length) || (path === "deep" && !quiz.deep.length));
  if (missing) throw new Error("This quiz has no questions yet. Add questions in the app and save.");
}

function defaultQuiz(): StoredQuiz {
  return JSON.parse(JSON.stringify({ quick: QUICK_QUESTIONS, deep: DEEP_QUESTIONS, profiles: PROFILES, mappings: [] })) as StoredQuiz;
}

async function ensureQuizTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuizConfig" (
      "shop" TEXT NOT NULL PRIMARY KEY,
      "payload" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export type QuizEntry = StoredQuiz & { handle: string; name: string; legacyHandles?: string[] };

export function quizCode(value: unknown) {
  const raw = clip(typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : value, 80);
  const wrapped = raw.match(/^\[dosha-quiz:([^\]]+)\]$/i);
  const handle = (wrapped ? wrapped[1] : raw).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return handle || "dosha-quiz";
}

function namedQuiz(quiz: StoredQuiz, handle: string, name: string): QuizEntry {
  return { ...quiz, handle: quizCode(handle), name: clip(name, 80) || "Skin quiz" };
}

function normalizeEntry(input: unknown, fallbackHandle: string): QuizEntry | null {
  if (!input || typeof input !== "object") return null;
  try {
    const source = input as { handle?: string; name?: string; legacyHandles?: string[] };
    return { ...namedQuiz(normalizeQuiz(input, { draft: true }), source.handle || fallbackHandle, source.name || "Skin quiz"), ...(Array.isArray(source.legacyHandles) ? {legacyHandles: source.legacyHandles.map(quizCode)} : {}) };
  } catch {
    return null;
  }
}

function normalizeLibrary(input: unknown): QuizEntry[] {
  const bundled = input && typeof input === "object" && Array.isArray((input as { quizzes?: unknown }).quizzes)
    ? (input as { quizzes: unknown[] }).quizzes
    : null;
  const items = bundled ? bundled.slice(0, 20).map((item, index) => normalizeEntry(item, `quiz-${index + 1}`)) : [normalizeEntry(input, "dosha-quiz")];
  const seen = new Set<string>();
  return items.filter((item): item is QuizEntry => {
    if (!item || seen.has(item.handle)) return false;
    seen.add(item.handle);
    return true;
  });
}

async function readPayload(shop: string) {
  await ensureQuizTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ payload: string }>>(
    `SELECT "payload" FROM "QuizConfig" WHERE "shop" = ? LIMIT 1`,
    shop,
  );
  if (!rows[0]?.payload) return null;
  try {
    return { value: JSON.parse(rows[0].payload) as unknown, raw: rows[0].payload };
  } catch {
    return null;
  }
}

async function writePayload(shop: string, quizzes: QuizEntry[], expected: string | null, scanDefaultInitialized = false, sampleQuizInitialized = false) {
  await ensureQuizTable();
  const initialized = scanDefaultInitialized || Boolean(expected && JSON.parse(expected).scanDefaultInitialized);
  const sampleInitialized = sampleQuizInitialized || Boolean(expected && JSON.parse(expected).sampleStarterInitialized);
  const payload = JSON.stringify({ quizzes, ...(initialized ? { scanDefaultInitialized: true } : {}), ...(sampleInitialized ? { sampleStarterInitialized: true } : {}) });
  const changed = expected === null
    ? await prisma.$executeRawUnsafe(`INSERT INTO "QuizConfig" ("shop", "payload", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT("shop") DO NOTHING`, shop, payload)
    : await prisma.$executeRawUnsafe(`UPDATE "QuizConfig" SET "payload"=?, "updatedAt"=CURRENT_TIMESTAMP WHERE "shop"=? AND "payload"=?`, payload, shop, expected);
  if (changed === 0) throw new Error("Another update changed your quiz library. Refresh and try again.");
}

export async function deleteShopQuizzes(shop: string) {
  await ensureQuizTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "QuizConfig" WHERE "shop" = ?`, shop);
}

export async function loadLibrary(shop: string): Promise<QuizEntry[]> {
  const payload = await readPayload(shop);
  const quizzes = payload ? normalizeLibrary(payload.value) : [];
  if (quizzes.length) return quizzes;
  return [];
}

// Initialize once from the app overview; deleting the starter does not recreate it.
export async function ensureDefaultScanWidget(shop: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await readPayload(shop);
    const flags = snapshot?.value && typeof snapshot.value === "object" ? snapshot.value as { scanDefaultInitialized?: boolean; sampleStarterInitialized?: boolean } : {};
    if (flags.scanDefaultInitialized && flags.sampleStarterInitialized) return;
    const library = snapshot ? normalizeLibrary(snapshot.value) : [];
    if (!flags.scanDefaultInitialized && !library.some(item => item.layout === "scan") && library.length < 20) {
      let number = Date.now();
      while (library.some(item => item.handle === String(number))) number++;
      const starter = defaultQuiz();
      starter.layout = "scan";
      starter.enabledPaths = ["scan"];
      starter.quick = [];
      starter.deep = [];
      library.push(namedQuiz(normalizeQuiz(starter, { draft: true }), String(number), "Only Skin Scan"));
    }
    if (!flags.sampleStarterInitialized && !library.some(item => item.name === "Sample Skin Quiz" && item.layout === "single") && library.length < 20) {
      let number = Date.now();
      while (library.some(item => item.handle === String(number))) number++;
      const sample = defaultQuiz();
      sample.layout = "single";
      sample.enabledPaths = ["quick"];
      sample.singleFlow = "quick";
      sample.quick = structuredClone(QUICK_QUESTIONS);
      sample.deep = [];
      library.push(namedQuiz(normalizeQuiz(sample, { draft: true }), String(number), "Sample Skin Quiz"));
    }
    try { await writePayload(shop, library, snapshot?.raw ?? null, true, true); return; }
    catch (error) { if (attempt === 2) throw error; }
  }
}

export async function loadQuiz(shop: string, code?: unknown): Promise<QuizEntry> {
  const library = await loadLibrary(shop);
  const handle = quizCode(code || "dosha-quiz");
  const selected = library.find((item) => (item.handle === handle || item.legacyHandles?.includes(handle))) || (!code ? library[0] : undefined);
  if (!selected) throw new Error("Quiz not found. Create a quiz first.");
  return selected;
}

export async function saveQuiz(shop: string, input: unknown, code?: unknown) {
  const snapshot = await readPayload(shop);
  const library = snapshot ? normalizeLibrary(snapshot.value) : [];
  let handle = quizCode(code || (input && typeof input === "object" ? (input as { handle?: string }).handle : "") || "dosha-quiz");
  const current = library.find(item => item.handle === handle || item.legacyHandles?.includes(handle));
  if (current) handle = current.handle;
  const merged = {
    ...(current || {}),
    ...(input && typeof input === "object" ? input : {}),
    handle,
    name: (input && typeof input === "object" && clip((input as { name?: string }).name, 80)) || current?.name || "Skin quiz",
  };
  const entry = namedQuiz(normalizeQuiz(merged), handle, clip(merged.name, 80) || "Skin quiz");
  if (current?.legacyHandles) entry.legacyHandles = current.legacyHandles;
  const quizzes = library.some((item) => item.handle === handle)
    ? library.map((item) => (item.handle === handle ? entry : item))
    : [...library, entry];
  await writePayload(shop, quizzes, snapshot?.raw ?? null);
  return entry;
}

export async function ensureNumericWidgetId(shop: string, code: string) {
  const snapshot = await readPayload(shop);
  const library = snapshot ? normalizeLibrary(snapshot.value) : [];
  const current = library.find(item => item.handle === code || item.legacyHandles?.includes(code));
  if (!current || /^\d+$/.test(current.handle)) return;
  let number = Date.now();
  while (library.some(item => item.handle === String(number))) number++;
  const replacement = {...current, handle:String(number), legacyHandles:[...new Set([...(current.legacyHandles || []),current.handle])]};
  await writePayload(shop, library.map(item => item.handle === current.handle ? replacement : item), snapshot!.raw);
}

export async function createQuiz(shop: string, name: string, layout: "three" | "single" | "scan" = "three", paths?: Array<"quick" | "deep" | "scan">, resultMode: "personalized" | "products" = "personalized") {
  const snapshot = await readPayload(shop);
  const library = snapshot ? normalizeLibrary(snapshot.value) : [];
  if (library.length >= 20) throw new Error("This store supports up to 20 quizzes. Delete an unused quiz before creating another.");
  // Widget IDs are generated independently of the merchant's quiz name.
  let widgetNumber = Date.now();
  while (library.some(item => item.handle === String(widgetNumber))) widgetNumber++;
  const handle = String(widgetNumber);
  // New quizzes start without questions; the merchant adds their own in the editor.
  const starter = defaultQuiz();
  starter.layout = layout;
  starter.resultMode = layout === "scan" ? "personalized" : resultMode;
  if (paths) starter.enabledPaths = paths;
  starter.singleFlow = paths?.[0] === "deep" ? "deep" : "quick";
  starter.quick = [];
  starter.deep = [];
  const entry = namedQuiz(normalizeQuiz(starter, { draft: true }), handle, clip(name, 80) || "New quiz");
  await writePayload(shop, [...library, entry], snapshot?.raw ?? null);
  return entry;
}

export async function deleteQuiz(shop: string, code: unknown) {
  const snapshot = await readPayload(shop);
  const library = snapshot ? normalizeLibrary(snapshot.value) : [];
  const handle = quizCode(code);
  const quizzes = library.filter((item) => item.handle !== handle);
  if (quizzes.length === library.length) return library;
  await writePayload(shop, quizzes, snapshot?.raw ?? null);
  return quizzes;
}

// No skin-analysis provider is integrated yet, so scan submissions cannot return a result.
// While this is false the storefront hides the scan path instead of asking shoppers for camera access.
export function scanAnalysisReady() {
  return false;
}

export async function publicQuiz(shop: string, code?: unknown) {
  const quiz = await loadQuiz(shop, code);
  assertHasQuestions(quiz);
  return {
    handle: quiz.handle,
    name: quiz.name,
    resultMode: quiz.resultMode,
    emailCapture: quiz.emailCapture,
    enabledPaths: quiz.enabledPaths,
    singleFlow: quiz.singleFlow,
    layout: quiz.layout || "three",
    scanner: quiz.scanner,
    cardIcons: {
      scan: quiz.cardIcons?.scan || DEFAULT_CARD_ICONS.scan,
      quick: quiz.cardIcons?.quick || DEFAULT_CARD_ICONS.quick,
      deep: quiz.cardIcons?.deep || DEFAULT_CARD_ICONS.deep,
    },
    scanReady: scanAnalysisReady(),
    design: quiz.design,
    widgetCss: quiz.widgetCss,
    texts: quiz.texts || {},
    hiddenTexts: quiz.hiddenTexts || [],
    defaultCss: defaultWidgetCss,
    apiVersion: 1,
    endpoints: { result: "/apps/dosha-quiz/result" },
    quick: quiz.quick,
    mappings: quiz.mappings,
    deep: quiz.deep.map((question) => ({
      image: question.image,
      layer: question.layer,
      phase: question.phase,
      text: question.text,
      sub: question.sub,
      options: question.options.map(({ label, hint, tags }) => ({ label, hint, tags })),
    })),
  };
}

function profileFor(dosha: string, profiles: Record<string, QuizProfile> = PROFILES) {
  return profiles[dosha] || profiles.balanced || PROFILES.balanced;
}

export function scoreQuick(
  answers: { q1?: string; q2?: string; q3?: string } | Record<string, string | number>,
  questions: QuickQuestion[] = QUICK_QUESTIONS,
) {
  const record = answers as Record<string, string | number | undefined>;
  const tags: string[] = [];
  questions.forEach((question, index) => {
    const option = optionForAnswer(question.options, record[String(index)], record[`q${index + 1}`]);
    if (option) tags.push(option.tag || asTag(option.value));
    else if (typeof record[`q${index + 1}`] === "string") tags.push(record[`q${index + 1}`] as string);
  });
  return resultFromTags(tags);
}

export function scoreDeep(answers: number[], questions: DeepQuestion[] = DEEP_QUESTIONS) {
  // Each answer counts once for the dosha it stands for (A = Vata, B = Pitta, C = Kapha in the spec); answers
  // that point to no single dosha (neutral options) are not counted.
  const counts = { vata: 0, pitta: 0, kapha: 0 };
  questions.forEach((question, index) => {
    const chosen = question.options[answers[index]];
    if (!chosen) return;
    const tag = asTag(chosen.tag, tagFromScores(chosen.scores || {}));
    if (tag === "vata" || tag === "pitta" || tag === "kapha") counts[tag] += 1;
  });
  const total = counts.vata + counts.pitta + counts.kapha;
  const percentages: Record<string, number> = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, total ? Math.floor(value / total * 100) : 0]));
  if (total) {
    const top = (Object.entries(counts).sort((first, second) => second[1] - first[1])[0][0]);
    percentages[top] += 100 - Object.values(percentages).reduce((sum, value) => sum + value, 0);
  }
  const dosha: DoshaResultKey = doshaFromCounts(counts);
  return { dosha, note: "", percentages, counts };
}

const KEYWORDS: Record<string, string[]> = {
  vata: ["hydrating", "nourishing", "gentle", "dry", "sensitive", "moisturizer", "serum", "oil", "cream", "rich", "soothing", "calming"],
  pitta: ["cooling", "calming", "sensitive", "reactive", "mist", "soothing", "mask", "anti-inflammatory", "aloe", "rose", "gentle"],
  kapha: ["clarifying", "purifying", "exfoliating", "oily", "mask", "clay", "clean", "detox", "brightening", "light", "awakening"],
  "dual-vata-pitta": ["balanced", "gentle", "calming", "nourishing", "serum", "mist", "adaptogenic", "soothing"],
  "dual-vata-kapha": ["nourishing", "cleansing", "mask", "moisturizer", "gentle", "rich"],
  "dual-kapha-pitta": ["purifying", "cooling", "mask", "mist", "clarifying", "balancing"],
  balanced: ["gentle", "balanced", "all", "basic", "universal", "everyday"],
};

function optionForAnswer<T extends { value?: string; tag?: string }>(
  options: T[],
  indexed: unknown,
  named: unknown,
) {
  if (typeof named === "string" && named && !/^\d+$/.test(named)) {
    return options.find((item) => item.value === named || item.tag === named);
  }
  const pick = indexed ?? named;
  if (typeof pick === "number" || (typeof pick === "string" && /^\d+$/.test(pick))) {
    return options[Number(pick)];
  }
  return undefined;
}

function chosenTags(quiz: StoredQuiz, submission: { path?: string; answers?: unknown }): string[] {
  const tags: string[] = [];
  const deepAnswers = submission.answers;
  if (submission.path === "deep" && Array.isArray(deepAnswers)) {
    quiz.deep.forEach((question, index) => {
      const option = question.options[Number(deepAnswers[index])];
      option?.tags?.forEach((tag) => tags.push(tag));
    });
  } else if (submission.path !== "scan") {
    const answers = (submission.answers || {}) as Record<string, string | number>;
    quiz.quick.forEach((question, index) => {
      const option = optionForAnswer(question.options, answers[String(index)], answers[`q${index + 1}`]);
      option?.tags?.forEach((tag) => tags.push(tag));
    });
  }
  return tags;
}

function mappedProducts(tags: string[], mappings: ProductMapping[], products: ShopProduct[]): QuizProduct[] {
  const seen = new Set<string>();
  const found: QuizProduct[] = [];
  mappings.forEach((mapping) => {
    const matches = mapping.grouping === "and" ? mapping.tags.every((tag) => tags.includes(tag)) : mapping.tags.some((tag) => tags.includes(tag));
    if (!matches) return;
    const key = mapping.variantId || mapping.productHandle;
    if (seen.has(key)) return;
    const product = products.find((item) => item.handle === mapping.productHandle);
    if (!product) return;
    const variant = mapping.variantId ? product.variants?.find((item) => item.id === mapping.variantId) : undefined;
    if (mapping.variantId && !variant) return;
    seen.add(key);
    found.push({
      title: variant ? `${product.title} — ${variant.title}` : product.title,
      price: variant?.price || product.price,
      image: variant?.image || product.image,
      ...(variant ? { variantId: variant.id } : {}),
      handle: product.handle,
      why: "Selected for your answers",
    });
  });
  return found.slice(0, 8);
}

export function ritualProducts(quiz: StoredQuiz, submission: { path?: string; answers?: unknown }, dosha: string, products: ShopProduct[]): QuizProduct[] {
  const roles: Record<string, string[]> = {
    cleanser: ["rose jasmine milk cleanser", "rose jasmine cleanser"],
    toner: ["pure rose water toning mist", "pure rose water mist"],
    saffron: ["saffron glow serum"],
    moisturizer: ["saffron radiance moisturizer", "saffron radiance moisturizer kumkumadi moisturizer"],
    bakuchiol: ["bakuchiol night restorative serum", "bakuchiol night serum"],
    mask: ["turmeric sandalwood mask", "turmeric sandalwood purifying mask", "turmeric sandalwood purifying clay mask", "turmeric and sandalwood face mask"],
  };
  const normalize = (text: string) => text.toLowerCase().replace(/^prana\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  let sequence = ["cleanser", "toner", "saffron"];
  let anchors: string[] = [];
  if (submission.path === "deep") {
    anchors = dosha.includes("vata") ? ["saffron", "moisturizer"] : dosha.includes("pitta") ? ["toner", "moisturizer"] : dosha.includes("kapha") ? ["mask", "bakuchiol"] : ["saffron"];
  } else {
    const answers = submission.answers as Record<string, string | number>;
    const labels = quiz.quick.map((question, at) => optionForAnswer(question.options, answers[String(at)], answers[`q${at + 1}`])?.label.toLowerCase() || "");
    const timing = labels.find(value => /morning|night|weekly|full ritual|both/.test(value)) || "morning";
    sequence = /full ritual|both/.test(timing) ? ["cleanser", "toner", "saffron", "bakuchiol", "moisturizer"] : /night/.test(timing) ? ["cleanser", "bakuchiol", "moisturizer"] : /weekly/.test(timing) ? ["cleanser", "mask", "saffron"] : sequence;
    const concern = labels.find(value => /dull|glow|fine lines|firmness|dark spots|pigmentation|breakout|texture/.test(value)) || "";
    anchors = /fine lines|firmness/.test(concern) ? ["bakuchiol"] : /dark spots|pigmentation/.test(concern) ? ["saffron", "mask"] : /breakout|texture/.test(concern) ? ["mask"] : ["saffron"];
    if (labels.some(value => /dry/.test(value))) anchors.push("saffron", "moisturizer");
    if (labels.some(value => /oily|combination/.test(value))) anchors.push("mask", "bakuchiol");
    if (labels.some(value => /sensitive|reactive/.test(value))) { sequence = ["cleanser", "toner", ...sequence.filter(role => role !== "cleanser" && role !== "toner")]; }
  }
  const ordered = [...new Set([...sequence, ...anchors])];
  return ordered.flatMap(role => {
    const product = products.find(item => roles[role].includes(normalize(item.title)));
    return product ? [{ title: product.title, handle: product.handle, price: product.price, image: product.image, why: anchors.includes(role) ? "Selected for your primary concern" : "Your ritual sequence" }] : [];
  });
}
// Keyword/tag matching against the store catalog, topped up with the profile's suggested handles that exist in the store.
export function matchProducts(dosha: string, products: ShopProduct[], profiles?: Record<string, QuizProfile>): QuizProduct[] {
  const keywords = KEYWORDS[dosha] || KEYWORDS.balanced;
  const matched = products
    .map((product) => {
      const content = `${product.title} ${product.tags.join(" ")} ${product.productType}`.toLowerCase();
      const hits = keywords.filter((keyword) => content.includes(keyword)).slice(0, 3);
      let score = hits.length * 10;
      product.tags.forEach((tag) => {
        const lower = tag.toLowerCase();
        if (lower.includes(dosha)) score += 25;
      });
      return { product, hits, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const picked: QuizProduct[] = matched.map(({ product, hits }) => ({
    title: product.title,
    price: product.price,
    image: product.image,
    handle: product.handle,
    why: hits.length ? `Chosen for ${hits.join(", ")}` : "",
  }));
  for (const handle of profileFor(dosha, profiles).products) {
    if (picked.length >= 4) break;
    const product = products.find((item) => item.handle === handle);
    if (product && !picked.some((item) => item.handle === handle)) picked.push({ title: product.title, price: product.price, image: product.image, handle, why: "" });
  }
  return picked;
}

type AdminGraphql = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

type ProductNode = {
  id?: string;
  title?: string;
  handle?: string;
  tags?: string[];
  productType?: string;
  featuredMedia?: { preview?: { image?: { url?: string } } };
  variants?: { nodes: Array<{ id?: string; title?: string; price?: string; image?: { url?: string } }>; pageInfo?: { hasNextPage?: boolean; endCursor?: string } };
};

const PRODUCT_PAGES = 5;

function formatPrice(amount: string | undefined, currency: string) {
  if (!amount || !Number.isFinite(Number(amount))) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

export async function loadStoreProducts(admin: AdminGraphql): Promise<ShopProduct[]> {
  const nodes: ProductNode[] = [];
  let currency = "USD";
  let after: string | null = null;
  // Up to 250 products, 50 per page, to stay below Shopify's query cost limit.
  for (let page = 0; page < PRODUCT_PAGES; page++) {
    const response = await admin.graphql(`#graphql
      query DoshaQuizProducts($after: String) {
        shop { currencyCode }
        products(first: 50, after: $after, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            tags
            productType
            featuredMedia {
              preview {
                image { url }
              }
            }
            variants(first: 10) {
              nodes { id title price image { url } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    `, { variables: { after } });
    const json = await response.json();
    if (json.errors?.length) throw new Error("Could not load store products.");
    currency = json?.data?.shop?.currencyCode || currency;
    nodes.push(...(json?.data?.products?.nodes || []));
    const info = json?.data?.products?.pageInfo;
    if (!info?.hasNextPage || !info.endCursor) break;
    after = info.endCursor;
  }
  // Fetch additional variant pages only when needed.
  for (const node of nodes) {
    let page = node.variants?.pageInfo;
    while (page?.hasNextPage && page.endCursor) {
      const more = await admin.graphql(`#graphql
        query DoshaQuizVariantPage($id: ID!, $after: String) {
          product(id: $id) {
            variants(first: 100, after: $after) {
              nodes { id title price image { url } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `, { variables: { id: node.id, after: page.endCursor } });
      const next = await more.json();
      if (next.errors?.length || !next.data?.product?.variants) throw new Error("Could not load product variants.");
      const variants = next.data.product.variants;
      node.variants!.nodes.push(...variants.nodes);
      if (variants.pageInfo?.hasNextPage && variants.pageInfo.endCursor === page.endCursor) throw new Error("Could not advance product variants.");
      page = variants.pageInfo;
    }
  }
  return nodes.map((node) => ({
    title: node.title || "Product",
    handle: node.handle || "",
    tags: node.tags || [],
    productType: node.productType || "",
    image: node.featuredMedia?.preview?.image?.url || "",
    price: formatPrice(node.variants?.nodes?.[0]?.price, currency),
    variants: (node.variants?.nodes || []).filter((variant) => variant.id).map((variant) => ({
      id: variant.id!, title: variant.title || "Default", price: formatPrice(variant.price, currency), image: variant.image?.url || "",
    })),
  }));
}

const PRODUCT_CACHE_MS = 5 * 60 * 1000;
const productCache = new Map<string, { at: number; products: Promise<ShopProduct[]> }>();

export function clearProductCache(shop?: string) {
  if (shop) productCache.delete(shop);
  else productCache.clear();
}

// Every storefront submission needs the catalog; cache it per shop for a few minutes.
function cachedStoreProducts(shop: string, admin: AdminGraphql) {
  const hit = productCache.get(shop);
  if (hit && Date.now() - hit.at < PRODUCT_CACHE_MS) return hit.products;
  const products = loadStoreProducts(admin);
  productCache.set(shop, { at: Date.now(), products });
  // Drop a failed load, but never a newer entry that replaced it.
  products.catch(() => { if (productCache.get(shop)?.products === products) productCache.delete(shop); });
  return products;
}

// The spec's ritual for a result as store products, in ritual order (morning, night, weekly, optional),
// matched by handle first and then by product name. Each product says when it is used.
const normalizeTitle = (value: string) => value.toLowerCase().replace(/^prana\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
export function ritualProductsFor(dosha: string, catalog: ShopProduct[]): QuizProduct[] {
  const content = DOSHA_CONTENT[dosha as DoshaResultKey];
  if (!content) return [];
  const { morning, night, optional, weekly } = content.products;
  const order: string[] = [];
  const when: Record<string, string[]> = {};
  const add = (handle: string, label: string) => { if (!order.includes(handle)) order.push(handle); (when[handle] ||= []).includes(label) || when[handle].push(label); };
  morning.forEach((handle) => add(handle, "Morning"));
  night.forEach((handle) => add(handle, "Night"));
  add(weekly.product, FREQUENCY_LABELS[weekly.frequency] || "Weekly");
  optional.forEach((handle) => add(handle, "Optional, as needed"));
  return order.flatMap((handle) => {
    const name = normalizeTitle(RITUAL_PRODUCTS[handle] || handle);
    const words = new Set(name.split(" "));
    // Every word of the spec name appears in the product title (e.g. "...Purifying Mask" in "...Purifying Clay Mask"),
    // or a product title of 3+ words is fully contained in the spec name; short generic titles never match.
    const sameWords = (title: string) => { const other = new Set(normalizeTitle(title).split(" ")); return [...words].every((word) => other.has(word)) || (other.size >= 3 && [...other].every((word) => words.has(word))); };
    const product = catalog.find((item) => item.handle === handle)
      || catalog.find((item) => normalizeTitle(item.title) === name)
      || catalog.find((item) => sameWords(item.title));
    if (!product) return [];
    const variant = product.variants?.[0];
    return [{ title: product.title, handle: product.handle, price: variant?.price || product.price, image: variant?.image || product.image, ...(variant?.id ? { variantId: variant.id } : {}), why: when[handle].join(" · ") }];
  });
}

export async function buildQuizResult(
  submission: { path?: string; answers?: unknown; code?: unknown },
  shop: string,
  admin?: AdminGraphql,
  validatedQuiz?: StoredQuiz,
): Promise<QuizResult> {
  const quiz = validatedQuiz || await loadQuiz(shop, submission.code);
  assertHasQuestions(quiz);
  if (quiz.layout === "scan" && submission.path !== "scan") throw new Error("This block only supports Skin Scan.");
  if (quiz.enabledPaths && !quiz.enabledPaths.includes(submission.path as "quick" | "deep" | "scan")) throw new Error("This quiz path is not enabled.");
  if (quiz.layout === "single" && submission.path !== (quiz.singleFlow || "quick")) {
    throw new Error("This quiz only supports the single question flow.");
  }
  let dosha = "balanced";
  let source = "Quick Quiz";
  let note = "";
  let percentages: Record<string, number> | undefined;
  const markers: QuizResult["markers"] = null;
  let showUpgrade = quiz.layout !== "single" && quiz.layout !== "scan";

  if (submission.path === "deep" && Array.isArray(submission.answers)) {
    const scored = scoreDeep(submission.answers.map((value) => Number(value)), quiz.deep);
    dosha = scored.dosha;
    note = scored.note;
    percentages = scored.percentages;
    source = "Deep Dosha";
    showUpgrade = false;
  } else if (submission.path === "scan") {
    throw new Error("Real skin analysis is not configured yet. Please use the question quiz for now.");
  } else {
    const answers = (submission.answers || {}) as Record<string, string | number>;
    dosha = scoreQuick(answers, quiz.quick);
    source = "Quick Quiz";
  }

  const profile = profileFor(dosha, quiz.profiles);
  let products: QuizProduct[] = [];
  if (admin && quiz.mappings.length > 0) {
    try {
      const storeProducts = await cachedStoreProducts(shop, admin);
      const tags = chosenTags(quiz, submission);
      if (submission.path === "scan") tags.push("scan", "ai_skin_scan");
      // Result tags use the same slug format as mapping tags, plus each dosha in a dual result.
      tags.push(slugTag(dosha), ...dosha.split("-").filter((part) => part === "vata" || part === "pitta" || part === "kapha"));
      if (quiz.mappings.length) products = mappedProducts(tags, quiz.mappings, storeProducts);
    } catch (error) {
      console.error("Quiz product recommendations failed", shop, error);
      products = [];
    }
  }
  // Quick Quiz is a product-match flow; use its answer-based ritual when no merchant mapping matched.
  if (!products.length && admin && submission.path === "quick") {
    try { products = ritualProducts(quiz, submission, dosha, await cachedStoreProducts(shop, admin)); }
    catch (error) { console.error("Quick quiz product recommendations failed", shop, error); products = []; }
  }
  // Deep Dosha reports without matching merchant mappings get the spec ritual for the result, in ritual order.
  if (!products.length && admin && submission.path === "deep" && quiz.resultMode !== "products" && DOSHA_CONTENT[dosha as DoshaResultKey]) {
    try { products = ritualProductsFor(dosha, await cachedStoreProducts(shop, admin)); }
    catch (error) { console.error("Dosha ritual products failed", shop, error); products = []; }
  }

  const insight = submission.path === "scan"
    ? note.trim()
    : `${profile.insight}${note}`;

  const productsOnly = quiz.resultMode === "products" || submission.path === "quick";
  const guide = submission.path === "deep" && quiz.resultMode !== "products" ? doshaGuide(dosha) : undefined;
  return { ...(guide ? { guide } : {}), resultMode: productsOnly ? "products" : quiz.resultMode, dosha, percentages: productsOnly ? undefined : percentages, source, showUpgrade: productsOnly ? false : showUpgrade, insight: productsOnly ? "" : insight, profile: productsOnly ? { ...profile, name: "Your product matches", sub: "Selected from your answers", essence: "", insight: "", products: [] } : profile, markers, products };
}
