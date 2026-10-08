import { hasOpenAIKey, selectedProvider } from "./settings.server";
import { loadLibrary } from "./quiz.server";
import { isThemeActivated, markThemeActivated } from "./setup.server";
import { isQuizLive, themeStatus } from "./theme.server";

type AdminGraphql = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

const COVER_COLORS: Record<string, [string, string]> = {
  three: ["#dfcba9", "#c6d2c3"],
  single: ["#e3c3b8", "#cfd6e3"],
  scan: ["#c9d8d2", "#e6d5b0"],
};

// Placeholder cover that carries the quiz's own name, used when no cover image is set.
function placeholderCover(name: string, layout: string) {
  const [warm, cool] = COVER_COLORS[layout] || COVER_COLORS.three;
  const title = (name.length > 28 ? `${name.slice(0, 27)}…` : name).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><rect width="720" height="480" fill="#f4ede3"/><circle cx="570" cy="100" r="190" fill="${warm}"/><circle cx="130" cy="440" r="210" fill="${cool}"/><path d="M350 315C230 260 250 140 350 150C450 140 470 260 350 315Z" fill="#faf7f2"/><path d="M350 305V180M350 250L300 205M350 225L390 190" fill="none" stroke="#8d9b7d" stroke-width="5"/><text x="360" y="380" text-anchor="middle" fill="#574a37" font-family="Georgia,serif" font-size="30">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Quiz cards plus theme activation state, shared by the Home and Quizzes pages.
export async function quizOverview(shop: string, admin: AdminGraphql) {
  const [quizzes, theme, activatedBefore] = await Promise.all([loadLibrary(shop), themeStatus(admin), isThemeActivated(shop)]);
  const scanReady = await selectedProvider(shop) === "openai" && await hasOpenAIKey(shop);
  const live = quizzes.map((quiz) => isQuizLive(theme, { handle: quiz.handle, layout: quiz.layout || "three" }, quizzes.filter((item) => (item.layout || "three") === (quiz.layout || "three")).length === 1));
  // Activation is a one-time store setup step, independent of individual widget IDs.
  const activatedNow = theme.blocks.length > 0;
  if (!activatedBefore && activatedNow) await markThemeActivated(shop);
  const store = shop.replace(".myshopify.com", "");
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  return {
    themeChecked: theme.checked,
    themeActivated: theme.checked ? live.some(Boolean) : activatedBefore,
    themeEditorUrl: `https://admin.shopify.com/store/${store}/themes/current/editor`,
    quizzes: quizzes.map((quiz, index) => ({
      handle: quiz.handle,
      name: quiz.name,
      cover: quiz.coverImage || quiz.quick.find(question => question.image)?.image || quiz.deep.find(question => question.image)?.image || placeholderCover(quiz.name || "Quiz", quiz.layout || "three"),
      layout: quiz.layout || "three",
      questions: quiz.quick.length + quiz.deep.length,
      live: live[index],
      // Scan paths are hidden on the storefront until an analysis provider is connected.
      scanPending: (quiz.enabledPaths || []).includes("scan") && !scanReady,
      addUrl: `https://admin.shopify.com/store/${store}/themes/current/editor?template=index&addAppBlockId=${apiKey}/${quiz.layout === "single" ? "single-quiz" : quiz.layout === "scan" ? "skin-scan" : "dosha-quiz"}&target=newAppsSection`,
    })),
  };
}
