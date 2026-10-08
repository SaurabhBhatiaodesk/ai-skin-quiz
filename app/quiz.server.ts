import prisma from "./db.server";
import { scoresForTag, slugTag } from "./quiz-shared";
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
};
export type QuizResult = {
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
    products: ["saffron-glow-serum", "saffron-radiance-moisturizer", "bakuchiol-night-serum", "rose-jasmine-cleanser"],
  },
  pitta: {
    name: "Pitta",
    sub: "Fire & Water · The energy of transformation",
    heroClass: "rh-pitta",
    modal: "pitta",
    essence: "Luminous when calm, reactive when pushed — your skin reflects your inner fire with precision and immediacy.",
    insight: "Your skin is <em>Pitta-dominant</em> — warm, luminous, and intelligent. It responds quickly to stress and heat, showing redness, pigmentation, and sensitivity as signals. Your ritual is built around cooling, calming anti-inflammatory intelligence.",
    products: ["rose-jasmine-cleanser", "rose-water-mist", "turmeric-sandalwood-mask", "bakuchiol-night-serum"],
  },
  kapha: {
    name: "Kapha",
    sub: "Earth & Water · The energy of structure",
    heroClass: "rh-kapha",
    modal: "kapha",
    essence: "Built for the long game — Kapha skin ages slowly and beautifully when it's given clarity and movement.",
    insight: "Your skin is <em>Kapha-dominant</em> — thick, stable, and slow to age. The challenge is circulation: congestion, enlarged pores, and dullness. Your ritual is built around deep cleansing, clay, and brightening botanicals.",
    products: ["rose-jasmine-cleanser", "turmeric-sandalwood-mask", "saffron-glow-serum", "rose-water-mist"],
  },
  "dual-vata-pitta": {
    name: "Vata–Pitta",
    sub: "Air, Space & Fire · The creative flame",
    heroClass: "rh-vata",
    modal: "vata",
    essence: "The artist's constitution — quick, radiant, reactive. Your skin is full of life and full of opinions.",
    insight: "Your skin is <em>Vata–Pitta dual dominant</em> — combining Vata's delicacy with Pitta's reactivity. Your ritual bridges both: soothing the fire while feeding the air.",
    products: ["rose-jasmine-cleanser", "rose-water-mist", "bakuchiol-night-serum", "saffron-glow-serum"],
  },
  "dual-vata-kapha": {
    name: "Vata–Kapha",
    sub: "Air, Space & Earth · Grounded movement",
    heroClass: "rh-vata",
    modal: "vata",
    essence: "The nurturer's constitution — resilient and sensitive. Your skin alternates between thirst and congestion.",
    insight: "Your skin is <em>Vata–Kapha dual dominant</em> — sometimes dry and delicate, sometimes congested and dull. Your products need to do both without compromising either.",
    products: ["rose-jasmine-cleanser", "turmeric-sandalwood-mask", "saffron-radiance-moisturizer", "saffron-glow-serum"],
  },
  "dual-kapha-pitta": {
    name: "Kapha–Pitta",
    sub: "Earth, Water & Fire · Powerful radiance",
    heroClass: "rh-pitta",
    modal: "pitta",
    essence: "Resilient and radiant — your skin has extraordinary capacity when it's working in harmony.",
    insight: "Your skin is <em>Kapha–Pitta dual dominant</em> — combining Kapha's structure with Pitta's intensity. Your ritual focuses on purifying clarity and cooling.",
    products: ["rose-jasmine-cleanser", "turmeric-sandalwood-mask", "rose-water-mist", "saffron-glow-serum"],
  },
  balanced: {
    name: "Tridoshic",
    sub: "Vata · Pitta · Kapha · In balance",
    heroClass: "rh-pitta",
    modal: "tridoshic",
    essence: "The rarest constitution — all three energies in relative harmony. Your ritual is about maintenance, not correction.",
    insight: "Your skin reads as <em>Tridoshic</em> — all three doshas in relative balance. This is the rarest and most resilient skin constitution. Your ritual focus is seasonal maintenance.",
    products: ["rose-jasmine-cleanser", "rose-water-mist", "saffron-glow-serum", "bakuchiol-night-serum"],
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

function deep(
  layer: number,
  phase: string,
  text: string,
  sub: string,
  options: Array<[string, string, Record<string, number>]>,
): DeepQuestion {
  return {
    layer,
    phase,
    text,
    sub,
    options: options.map(([label, hint, scores]) => ({ label, hint, scores })),
  };
}

export const DEEP_QUESTIONS: DeepQuestion[] = [
  deep(1, "Prakriti · Your baseline nature", "Your body's natural relationship with temperature?", "Your default state — not how you feel today.", [["I run cold — always reaching for warmth", "Hands and feet often cold", { V: 3 }], ["I run warm — often the hottest in the room", "Intense body heat, flushes easily", { P: 3 }], ["Comfortable in most temperatures", "Rarely extreme cold or heat", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "Your skin without any products — describe it.", "Baseline skin, not during a breakout.", [["Thin, dry, dehydrated — tight without moisture", "Delicate texture, veins slightly visible", { V: 3 }], ["Combination or oily with redness or sensitivity", "Pores visible in T-zone, occasional flushing", { P: 3 }], ["Thick, smooth, naturally hydrated", "Porcelain quality, holds moisture well", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "How does stress show up in your body first?", "Your primary stress response.", [["Anxiety, racing thoughts, insomnia", "Mind goes faster than the body", { V: 3 }], ["Irritability, inflammation, anger", "Body temperature rises with stress", { P: 3 }], ["Withdrawal, heaviness, oversleeping", "Body slows down and holds on", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "Your natural appetite and digestion?", "When life is balanced — not when stressed.", [["Variable — sometimes hungry, sometimes not", "Irregular, easily disrupted", { V: 3 }], ["Strong, regular, irritable when delayed", "Sharp hunger on a schedule", { P: 3 }], ["Steady but slow — could skip meals easily", "Comfortable going long without eating", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "Your body's natural weight tendency?", "Without intervention — your set point.", [["Lean, hard to gain weight", "Slight build, lighter bones", { V: 3 }], ["Medium build, gains and loses relatively easily", "Athletic or medium frame", { P: 3 }], ["Heavier build, gains weight easily", "Rounder, solid frame", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "How do you process information and make decisions?", "Your natural cognitive style.", [["Quick to learn, quick to forget — scattered", "Ideas arrive fast, retention is harder", { V: 3 }], ["Sharp, analytical, decisive", "Cuts through complexity quickly", { P: 3 }], ["Slow and steady — strong long-term memory", "Takes time to process, remembers everything", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "Your hair at its natural baseline?", "Without products — its default texture.", [["Dry, fine, frizzy or wavy", "Prone to breakage, flies away", { V: 3 }], ["Medium, oily at roots, or prematurely greying", "Heat-sensitive, fine-to-medium", { P: 3 }], ["Thick, lustrous, slow to grey", "Dense, holds moisture naturally", { K: 3 }]]),
  deep(1, "Prakriti · Your baseline nature", "Your energy across the day?", "Without caffeine or external stimulants.", [["Burst and crash — high energy then sudden fatigue", "Variable, hard to sustain", { V: 3 }], ["Moderate, purposeful — burns out when pushed too hard", "Efficient but finite", { P: 3 }], ["Slow to start, strong endurance once moving", "Steady long-burn energy", { K: 3 }]]),
  deep(2, "Vikriti · Your current state", "How does your skin feel right now today?", "This week — what you're actually experiencing.", [["Dry, tight, flaky, or dehydrated", "Needs moisture urgently", { Vv: 3 }], ["Reactive, red, sensitised, or breaking out", "Inflamed or irritated", { Pv: 3 }], ["Congested, dull, or heavier than usual", "Feeling sluggish and clogged", { Kv: 3 }]]),
  deep(2, "Vikriti · Your current state", "Your sleep quality recently?", "The last two to three weeks.", [["Disrupted, light, mind won't switch off", "Anxiety-driven poor sleep", { Vv: 3 }], ["Adequate but vivid dreams, wake feeling hot", "Intense sleep", { Pv: 3 }], ["Heavy, long, hard to wake — still feel tired", "Oversleeping without rest", { Kv: 3 }]]),
  deep(2, "Vikriti · Your current state", "Your stress level right now?", "Honestly — this week.", [["High anxiety, overwhelm, scattered", "Hard to focus or settle", { Vv: 3 }], ["High pressure, frustration, intensity", "Driven but burning", { Pv: 3 }], ["Feeling stuck, heavy, unmotivated", "Slow and resistant", { Kv: 3 }]]),
  deep(2, "Vikriti · Your current state", "Your diet recently?", "What you've actually been eating — honestly.", [["Irregular, cold foods, too much raw", "Skipping meals, erratic eating", { Vv: 3 }], ["Spicy, acidic, hot foods, caffeine or alcohol", "Stimulating diet", { Pv: 3 }], ["Heavy, sweet, processed, or dairy-rich", "Comfort eating or sluggish foods", { Kv: 3 }]]),
  deep(2, "Vikriti · Your current state", "Your primary skin concern right now?", "What you'd fix first if you could.", [["Dehydration, fine lines appearing, dullness", "Skin feels depleted", { Vv: 3 }], ["Redness, sensitivity, hyperpigmentation, breakouts", "Skin is reactive", { Pv: 3 }], ["Congestion, enlarged pores, excess oil, flat texture", "Skin feels heavy", { Kv: 3 }]]),
  deep(2, "Vikriti · Your current state", "How long have you felt this way?", "When did your skin last feel truly balanced?", [["Recently — last few weeks", "Acute, triggered by something", { Vv: 1, Pv: 1, Kv: 1 }], ["Several months", "Chronic pattern building", { Vv: 2, Pv: 2, Kv: 2 }], ["This is just how my skin is", "Long-standing imbalance", { Vv: 3, Pv: 3, Kv: 3 }]]),
  deep(3, "Environment · Your external world", "Your climate right now?", "Where you live — current conditions.", [["Cold, dry, or windy", "Autumn/winter or arid", { V: 2 }], ["Hot, humid, or intense sun", "Summer or tropical", { P: 2 }], ["Cool, damp, or overcast", "Spring or temperate", { K: 2 }]]),
  deep(3, "Environment · Your external world", "Your current season?", "Seasonally, where are you right now?", [["Autumn or early winter", "Vata season — dry and mobile", { V: 2 }], ["Late spring or summer", "Pitta season — hot and intense", { P: 2 }], ["Late winter or spring", "Kapha season — heavy and damp", { K: 2 }]]),
  deep(3, "Environment · Your external world", "Your water quality at home?", "What your skin absorbs daily in the shower.", [["Hard water — mineral-heavy", "May strip or irritate the skin barrier", { Pv: 1, Vv: 1 }], ["Soft water or filtered", "Gentler on the skin", { K: 1 }], ["Unknown", "I've never thought about it", {}]]),
  deep(3, "Environment · Your external world", "Your current skincare ritual consistency?", "Honestly — how often do you actually do it?", [["Minimal or irregular — maybe 3-4 times a week", "No established ritual yet", { Vv: 1 }], ["Daily but quick — under 5 minutes", "Functional routine", {}], ["Consistent and intentional — morning and night", "Committed practice", { K: 1 }]]),
];

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
    title: clip(scan?.title, 80) || "AI Skin Scan",
    description: clip(scan?.description, 240) || "Skin scan analysis is not configured. Try the question quiz.",
    camera: scan?.camera !== false,
    upload: scan?.upload !== false,
  };
  if (!scanner.camera && !scanner.upload) throw new Error("Enable camera or photo upload for Skin Scan.");
  const suppliedDesign = (input as StoredQuiz)?.design;
  function color(value: unknown, fallback: string) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Use six-digit hex colors in Quiz design.");
    return value;
  }
  const design: NonNullable<StoredQuiz["design"]> = {
    background: color(suppliedDesign?.background, "#faf7f2"), text: color(suppliedDesign?.text, "#1a1208"),
    accent: color(suppliedDesign?.accent, "#8f6330"), buttonText: color(suppliedDesign?.buttonText, "#ffffff"),
    font: suppliedDesign?.font === "sans" ? "sans" : "classic",
    radius: suppliedDesign?.radius === "square" ? "square" : suppliedDesign?.radius === "pill" ? "pill" : "rounded",
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
  const suppliedCss = (input as StoredQuiz)?.widgetCss;
  if (suppliedCss !== undefined && (typeof suppliedCss !== "string" || suppliedCss.length > 100000)) throw new Error("Widget CSS must be text under 100,000 characters.");
  // Widget CSS holds custom overrides only. Older saves stored a full copy of the default stylesheet,
  // which would freeze the widget on outdated styles, so those copies are dropped.
  const widgetCss = typeof suppliedCss === "string" && !DEFAULT_CSS_MARKER.test(suppliedCss.trimStart()) ? suppliedCss : undefined;
  const email = (input as StoredQuiz)?.emailCapture;
  const emailCapture = { enabled: email?.enabled === true, heading: clip(email?.heading, 120) || "Where should we send your ritual?", button: clip(email?.button, 40) || "See my ritual", allowSkip: email?.allowSkip !== false };
  return { emailCapture, enabledPaths, singleFlow, coverImage, profileImage, widgetCss, layout, scanner, design, scanIntegration, quick: enabledPaths.includes("quick") ? quick : [], deep: enabledPaths.includes("deep") ? deep : [], profiles: normalizeProfiles(source.profiles), mappings: normalizeMappings(source.mappings) };
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

export type QuizEntry = StoredQuiz & { handle: string; name: string };

export function quizCode(value: unknown) {
  const raw = clip(value, 80);
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
    const source = input as { handle?: string; name?: string };
    return namedQuiz(normalizeQuiz(input, { draft: true }), source.handle || fallbackHandle, source.name || "Skin quiz");
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
    return JSON.parse(rows[0].payload) as unknown;
  } catch {
    return null;
  }
}

async function writePayload(shop: string, quizzes: QuizEntry[]) {
  await ensureQuizTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuizConfig" ("shop", "payload", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT("shop") DO UPDATE SET "payload" = excluded."payload", "updatedAt" = CURRENT_TIMESTAMP`,
    shop,
    JSON.stringify({ quizzes }),
  );
}

export async function deleteShopQuizzes(shop: string) {
  await ensureQuizTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "QuizConfig" WHERE "shop" = ?`, shop);
}

export async function loadLibrary(shop: string): Promise<QuizEntry[]> {
  const payload = await readPayload(shop);
  const quizzes = payload ? normalizeLibrary(payload) : [];
  if (quizzes.length) return quizzes;
  return [];
}

export async function loadQuiz(shop: string, code?: unknown): Promise<QuizEntry> {
  const library = await loadLibrary(shop);
  const handle = quizCode(code || "dosha-quiz");
  const selected = library.find((item) => item.handle === handle) || (!code ? library[0] : undefined);
  if (!selected) throw new Error("Quiz not found. Create a quiz first.");
  return selected;
}

export async function saveQuiz(shop: string, input: unknown, code?: unknown) {
  const library = await loadLibrary(shop);
  const handle = quizCode(code || (input && typeof input === "object" ? (input as { handle?: string }).handle : "") || "dosha-quiz");
  const current = library.find((item) => item.handle === handle);
  const merged = {
    ...(current || {}),
    ...(input && typeof input === "object" ? input : {}),
    handle,
    name: (input && typeof input === "object" && clip((input as { name?: string }).name, 80)) || current?.name || "Skin quiz",
  };
  const entry = namedQuiz(normalizeQuiz(merged), handle, clip(merged.name, 80) || "Skin quiz");
  const quizzes = library.some((item) => item.handle === handle)
    ? library.map((item) => (item.handle === handle ? entry : item))
    : [...library, entry];
  await writePayload(shop, quizzes);
  return entry;
}

export async function createQuiz(shop: string, name: string, layout: "three" | "single" | "scan" = "three", paths?: Array<"quick" | "deep" | "scan">) {
  const library = await loadLibrary(shop);
  const base = quizCode(name || `quiz-${library.length + 1}`);
  let handle = base;
  for (let suffix = 2; library.some((item) => item.handle === handle); suffix++) handle = quizCode(`${base.slice(0, 34)}-${suffix}`);
  // New quizzes start without questions; the merchant adds their own in the editor.
  const starter = defaultQuiz();
  starter.layout = layout;
  if (paths) starter.enabledPaths = paths;
  starter.singleFlow = paths?.[0] === "deep" ? "deep" : "quick";
  starter.quick = [];
  starter.deep = [];
  const entry = namedQuiz(normalizeQuiz(starter, { draft: true }), handle, clip(name, 80) || "New quiz");
  await writePayload(shop, [...library, entry]);
  return entry;
}

export async function deleteQuiz(shop: string, code: unknown) {
  const library = await loadLibrary(shop);
  const handle = quizCode(code);
  const quizzes = library.filter((item) => item.handle !== handle);
  if (quizzes.length === library.length) return library;
  await writePayload(shop, quizzes);
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
    emailCapture: quiz.emailCapture,
    enabledPaths: quiz.enabledPaths,
    singleFlow: quiz.singleFlow,
    layout: quiz.layout || "three",
    scanner: quiz.scanner,
    scanReady: scanAnalysisReady(),
    design: quiz.design,
    widgetCss: quiz.widgetCss,
    quick: quiz.quick,
    deep: quiz.deep.map((question) => ({
      layer: question.layer,
      phase: question.phase,
      text: question.text,
      sub: question.sub,
      options: question.options.map(({ label, hint }) => ({ label, hint })),
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
  const scores: Record<string, number> = { V: 0, P: 0, K: 0, Vv: 0, Pv: 0, Kv: 0 };
  const tags: string[] = [];
  questions.forEach((question, index) => {
    const chosen = question.options[answers[index]];
    if (!chosen) return;
    tags.push(chosen.tag || tagFromScores(chosen.scores));
    Object.entries(chosen.scores).forEach(([key, value]) => {
      scores[key] = (scores[key] || 0) + value;
    });
  });

  const totals = { vata: scores.V + scores.Vv, pitta: scores.P + scores.Pv, kapha: scores.K + scores.Kv };
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const ranking = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const percentages = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, total ? Math.floor(value / total * 100) : 0]));
  if (total) percentages[ranking[0][0]] += 100 - Object.values(percentages).reduce((sum, value) => sum + value, 0);
  const dosha = !total ? "balanced" : ranking[2][1] >= ranking[0][1] * 0.8 ? "balanced" : ranking[1][1] >= ranking[0][1] * 0.5 ? resultFromTags([ranking[0][0], ranking[1][0]]) : ranking[0][0];

  const vikVals = [scores.Vv, scores.Pv, scores.Kv];
  const vikMax = Math.max(...vikVals);
  const vikPrimary = ["Vv", "Pv", "Kv"][vikVals.indexOf(vikMax)];
  let note = "";
  if (vikMax > 6) {
    if (vikPrimary === "Vv") note = " Currently, Vata is elevated — your skin needs extra grounding and hydration.";
    else if (vikPrimary === "Pv") note = " Currently, Pitta is elevated — your skin needs cooling and anti-inflammatory support.";
    else note = " Currently, Kapha is elevated — your skin needs clarifying and stimulating treatment.";
  }
  return { dosha, note, percentages };
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
      why: mapping.tags.filter((tag) => tags.includes(tag)).join(", "),
    });
  });
  return found.slice(0, 8);
}

export function ritualProducts(quiz: StoredQuiz, submission: { path?: string; answers?: unknown }, dosha: string, products: ShopProduct[]): QuizProduct[] {
  const roles: Record<string, string[]> = {
    cleanser: ["rose jasmine milk cleanser", "rose jasmine cleanser"],
    toner: ["pure rose water toning mist", "pure rose water mist"],
    saffron: ["saffron glow serum"],
    moisturizer: ["saffron radiance moisturizer"],
    bakuchiol: ["bakuchiol night restorative serum", "bakuchiol night serum"],
    mask: ["turmeric sandalwood mask"],
  };
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

export async function buildQuizResult(
  submission: { path?: string; answers?: unknown; code?: unknown },
  shop: string,
  admin?: AdminGraphql,
): Promise<QuizResult> {
  const quiz = await loadQuiz(shop, submission.code);
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
  if (admin) {
    try {
      const storeProducts = await cachedStoreProducts(shop, admin);
      const tags = chosenTags(quiz, submission);
      if (submission.path === "scan") tags.push("scan", "ai_skin_scan");
      // Result tags use the same slug format as mapping tags, plus each dosha in a dual result.
      tags.push(slugTag(dosha), ...dosha.split("-").filter((part) => part === "vata" || part === "pitta" || part === "kapha"));
      if (quiz.mappings.length) products = mappedProducts(tags, quiz.mappings, storeProducts);
      if (!products.length) products = ritualProducts(quiz, submission, dosha, storeProducts);
      if (!products.length) products = matchProducts(dosha, storeProducts, quiz.profiles);
    } catch (error) {
      console.error("Quiz product recommendations failed", shop, error);
      products = [];
    }
  }

  const insight = submission.path === "scan"
    ? note.trim()
    : `${profile.insight}${note}`;

  return { dosha, percentages, source, showUpgrade, insight, profile, markers, products };
}
