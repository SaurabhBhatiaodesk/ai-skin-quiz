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
  texts?: Record<string, string>;
  hiddenTexts?: string[];
  enabledPaths?: Array<"quick" | "deep" | "scan">;
  singleFlow?: "quick" | "deep";
  cardIcons?: Partial<Record<"scan" | "quick" | "deep", string>>;
  coverImage?: string;
  profileImage?: string;
  layout?: "three" | "single" | "scan";
  scanner?: { title: string; description: string; camera: boolean; upload: boolean };
  scanIntegration?: { provider: string; endpoint: string; documentation: string };
  design?: { scanNoticeSize?: number; mobileScanNoticeSize?: number; scanToggleBg?: string; scanToggleActive?: string; scanUploadBg?: string; scanUploadBorder?: string; scanHint?: string; scanUploadHeight?: number; mobileScanUploadHeight?: number; scanStepIdle?: string; scanDivider?: string; scanNoticeText?: string; scanBoxBorder?: string; scanLabel?: string; scanAccent?: string; scanNoticeBg?: string; scanBoxBg?: string; scanTitleSize?: number; mobileScanTitleSize?: number; scanTextSize?: number; mobileScanTextSize?: number; headerTop?: number; mobileHeaderTop?: number; headerGap?: number; mobileHeaderGap?: number; entryTimeSize?: number; mobileEntryTimeSize?: number; entryIconBg?: string; entryIconSize?: number; mobileEntryIconSize?: number; entryTitleColor?: string; entryTextColor?: string; entryTimeColor?: string; entryGhost?: string; brandColor?: string; titleColor?: string; subtitleColor?: string; entryBg?: string; entryBorder?: string; entryFeatured?: string; entryTitleSize?: number; mobileEntryTitleSize?: number; entryTextSize?: number; mobileEntryTextSize?: number; entryPadding?: number; mobileEntryPadding?: number; entryGap?: number; mobileEntryGap?: number; entryRadius?: number; questionGap?: number; mobileQuestionGap?: number; buttonGap?: number; mobileButtonGap?: number; headingAccent?: string; brandSize?: number; mobileBrandSize?: number; mobileSubtitleSize?: number; backBg?: string; backText?: string; backBorder?: string; answerPadding?: number; mobileAnswerPadding?: number; scanCard?: string; scanText?: string; scanHeading?: string; scanButton?: string; scanButtonText?: string; headingColor?: string; cardColor?: string; answerColor?: string; answerText?: string; selectedColor?: string; selectedText?: string; headingSize?: number; questionSize?: number; bodySize?: number; answerSize?: number; buttonSize?: number; desktopWidth?: number; desktopPadding?: number; mobileWidth?: number; mobilePadding?: number; mobileHeadingSize?: number; mobileQuestionSize?: number; mobileAnswerSize?: number; answerSpacing?: number; mobileAnswerSpacing?: number; desktopButtonWidth?: number; mobileButtonWidth?: number; desktopButtonHeight?: number; mobileButtonHeight?: number; mobileButtonSize?: number; buttonAlignment?: "left" | "center" | "right"; background: string; text: string; accent: string; buttonText: string; font: "classic" | "sans"; radius: "square" | "rounded" | "pill" };
  quick: QuickQuestion[];
  deep: DeepQuestion[];
  profiles: Record<string, QuizProfile>;
  mappings: ProductMapping[];
};

export const recommendedQuizDesign: Omit<Required<NonNullable<StoredQuiz["design"]>>, "scanCard" | "scanText" | "scanHeading" | "scanButton" | "scanButtonText" | "backBg" | "backText" | "backBorder" | "headingAccent" | "entryBg" | "entryBorder" | "entryFeatured" | "brandColor" | "titleColor" | "subtitleColor" | "entryTitleColor" | "entryTextColor" | "entryTimeColor" | "entryGhost" | "entryIconBg" | "scanAccent" | "scanNoticeBg" | "scanBoxBg" | "scanToggleBg" | "scanToggleActive" | "scanUploadBg" | "scanUploadBorder" | "scanHint" | "scanStepIdle" | "scanDivider" | "scanNoticeText" | "scanBoxBorder" | "scanLabel"> = {
  scanNoticeSize: 13,
  mobileScanNoticeSize: 12,
  scanUploadHeight: 240,
  mobileScanUploadHeight: 200,
  scanTitleSize: 26,
  mobileScanTitleSize: 22,
  scanTextSize: 15,
  mobileScanTextSize: 14,
  headerTop: 40,
  mobileHeaderTop: 24,
  headerGap: 40,
  mobileHeaderGap: 24,
  entryTimeSize: 11,
  mobileEntryTimeSize: 10,
  entryIconSize: 116,
  mobileEntryIconSize: 104,
  entryTitleSize: 26,
  mobileEntryTitleSize: 24,
  entryTextSize: 14,
  mobileEntryTextSize: 14,
  entryPadding: 30,
  mobileEntryPadding: 22,
  entryGap: 26,
  mobileEntryGap: 16,
  entryRadius: 24,
  questionGap: 28,
  mobileQuestionGap: 20,
  buttonGap: 28,
  mobileButtonGap: 24,
  brandSize: 11,
  mobileBrandSize: 10,
  mobileSubtitleSize: 13,
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

// Editable widget texts (Quiz design > Texts). An unset key keeps the built-in text; a hidden key is not shown.
export const WIDGET_TEXT_GROUPS = [
  {
    "title": "Entry header",
    "items": [
      {
        "key": "entryBrand",
        "label": "Brand line",
        "placeholder": "PRANA Beauty & Wellness"
      },
      {
        "key": "entryTitle",
        "label": "Title",
        "placeholder": "Find Your"
      },
      {
        "key": "entryAccent",
        "label": "Highlight words",
        "placeholder": "Skin Ritual"
      },
      {
        "key": "entrySubtitle",
        "label": "Subtitle",
        "placeholder": "Three paths. One result. Your personal Ayurvedic ritual."
      }
    ]
  },
  {
    "title": "Skin Insights card",
    "items": [
      {
        "key": "scanBadge",
        "label": "Badge",
        "placeholder": "Photo analysis"
      },
      {
        "key": "scanName",
        "label": "Card title",
        "placeholder": "Skin Insights"
      },
      {
        "key": "scanDesc",
        "label": "Card text",
        "placeholder": "Use a camera or upload a photo for cosmetic skin observations."
      },
      {
        "key": "scanTime",
        "label": "Time line",
        "placeholder": "✦ 30 seconds"
      },
      {
        "key": "scanButton",
        "label": "Button",
        "placeholder": "Start Scan"
      }
    ]
  },
  {
    "title": "Quick Quiz card",
    "items": [
      {
        "key": "quickName",
        "label": "Card title",
        "placeholder": "Quick Quiz"
      },
      {
        "key": "quickDesc",
        "label": "Card text",
        "placeholder": "3 questions about your skin. Instant ritual match — no camera needed."
      },
      {
        "key": "quickTime",
        "label": "Time line",
        "placeholder": "About 1 min"
      },
      {
        "key": "quickButton",
        "label": "Button",
        "placeholder": "Take Quiz"
      }
    ]
  },
  {
    "title": "Deep Dosha card",
    "items": [
      {
        "key": "deepName",
        "label": "Card title",
        "placeholder": "Deep Dosha"
      },
      {
        "key": "deepDesc",
        "label": "Card text",
        "placeholder": "18 questions across constitution, current state, and environment. The full Ayurvedic reading."
      },
      {
        "key": "deepTime",
        "label": "Time line",
        "placeholder": "About 5 min"
      },
      {
        "key": "deepButton",
        "label": "Button",
        "placeholder": "Begin Reading"
      }
    ]
  },
  {
    "title": "Below the cards",
    "items": [
      {
        "key": "entryNote",
        "label": "Note",
        "placeholder": "Find your personalized ritual · Free · No account required"
      }
    ]
  },
  {
    "title": "Quick Quiz header",
    "items": [
      {
        "key": "quickTitle",
        "label": "Title",
        "placeholder": "Quick"
      },
      {
        "key": "quickAccent",
        "label": "Highlight words",
        "placeholder": "Ritual Match"
      },
      {
        "key": "quickSubtitle",
        "label": "Subtitle",
        "placeholder": "3 questions. Your personal ritual."
      }
    ]
  },
  {
    "title": "Deep Quiz header",
    "items": [
      {
        "key": "deepTitle",
        "label": "Title",
        "placeholder": "Dosha"
      },
      {
        "key": "deepAccent",
        "label": "Highlight words",
        "placeholder": "Diagnostic"
      },
      {
        "key": "deepSubtitle",
        "label": "Subtitle",
        "placeholder": "Three layers · Constitution · Current state · Environment"
      }
    ]
  }
] as const;
export const SCAN_TEXT_GROUP = {
  title: "Skin Scan screen",
  items: [
    { key: "scannerTitle", label: "Title", placeholder: "Skin" },
    { key: "scannerAccent", label: "Highlight words", placeholder: "Insights" },
    { key: "scannerSubtitle", label: "Subtitle", placeholder: "Discover your skin insights. Not a medical diagnosis." },
    { key: "scanStepTitle", label: "Step title", placeholder: "Ready to scan?" },
    { key: "scanStepIntro", label: "Step text", placeholder: "Confirm below, then take or upload a photo." },
    { key: "scanNotice", label: "Photo notice", placeholder: "Your photo is sent to our AI partner for this reading. Our app does not store it." },
    { key: "consentBio", label: "Photo consent (required, cannot be hidden)", placeholder: "I consent to our AI partner analysing my facial photo for cosmetic skin observations.", required: true },
    { key: "consentAge", label: "Age consent (required, cannot be hidden)", placeholder: "I am 18 or older.", required: true },
    { key: "consentMail", label: "Optional email consent", placeholder: "Optional: Email me skincare recommendations. I can unsubscribe anytime." },
    { key: "scanContinue", label: "Consent step button", placeholder: "Continue to photo →" },
    { key: "reviewConsent", label: "Review consent link", placeholder: "← Review consent" },
    { key: "photoTitle", label: "Photo step title", placeholder: "Take or upload your photo" },
    { key: "photoIntro", label: "Photo step text", placeholder: "Face forward in natural light, without filters." },
    { key: "cameraLabel", label: "Camera option", placeholder: "Live Camera" },
    { key: "uploadLabel", label: "Upload option", placeholder: "Upload Photo" },
    { key: "uploadTitle", label: "Upload box title", placeholder: "Tap to upload a selfie" },
    { key: "uploadSub", label: "Upload box text", placeholder: "JPG, PNG · Face forward, good light" },
    { key: "analyseButton", label: "Analyse button", placeholder: "Analyse My Skin →" },
  ],
} as const;
export const WIDGET_TEXT_KEYS: string[] = [...WIDGET_TEXT_GROUPS.flatMap(group => group.items.map(item => item.key)), ...SCAN_TEXT_GROUP.items.map(item => item.key)];
export const REQUIRED_TEXT_KEYS: string[] = SCAN_TEXT_GROUP.items.filter(item => "required" in item).map(item => item.key);
