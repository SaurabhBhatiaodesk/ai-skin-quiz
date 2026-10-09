import { hasOpenAIKey, selectedProvider } from "./settings.server";
import { ensureDefaultScanWidget, loadLibrary } from "./quiz.server";
import { isThemeActivated, markThemeActivated } from "./setup.server";
import { isQuizLive, themeStatus } from "./theme.server";

type AdminGraphql = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

// Quiz cards plus theme activation state, shared by the Home and Quizzes pages.
export async function quizOverview(shop: string, admin: AdminGraphql) {
  await ensureDefaultScanWidget(shop);
  const [quizzes, theme, activatedBefore] = await Promise.all([loadLibrary(shop), themeStatus(admin), isThemeActivated(shop)]);
  const scanReady = await selectedProvider(shop) === "openai" && await hasOpenAIKey(shop);
  const live = quizzes.map((quiz) => isQuizLive(theme, { handle: quiz.handle, legacyHandles: quiz.legacyHandles, layout: quiz.layout || "three" }, quizzes.filter((item) => (item.layout || "three") === (quiz.layout || "three")).length === 1));
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
      cover: quiz.coverImage || quiz.quick.find(question => question.image)?.image || quiz.deep.find(question => question.image)?.image || `/images/onboarding/cover-${quiz.layout === "scan" ? "scan" : quiz.layout === "single" ? "single" : "three"}.svg`,
      layout: quiz.layout || "three",
      questions: quiz.quick.length + quiz.deep.length,
      live: live[index],
      // Scan paths are hidden on the storefront until an analysis provider is connected.
      scanPending: (quiz.enabledPaths || []).includes("scan") && !scanReady,
      addUrl: `https://admin.shopify.com/store/${store}/themes/current/editor?template=index&addAppBlockId=${apiKey}/${quiz.layout === "single" ? "single-quiz" : quiz.layout === "scan" ? "skin-scan" : "dosha-quiz"}&target=newAppsSection`,
    })),
  };
}
