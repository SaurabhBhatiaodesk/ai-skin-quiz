import { loadScanAppearance } from "../scan-appearance.server";
import { hasOpenAIKey, selectedProvider, PROVIDER_NAMES } from "../settings.server";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadLibrary, publicQuiz, quizCode } from "../quiz.server";

function apiJson(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store" } });
}

function shopFrom(request: Request, shop?: string) {
  return shop || new URL(request.url).searchParams.get("shop") || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const params = new URL(request.url).searchParams;
  const rawCode = params.get("code")?.trim();
  const code = rawCode ? quizCode(rawCode) : undefined;
  const layout = params.get("layout");
  if (layout && !["three", "single", "scan"].includes(layout)) return apiJson({ error: "Choose a valid widget layout." }, { status: 400 });
  const shop = shopFrom(request, session?.shop);
  const provider = await selectedProvider(shop);
  const library = await loadLibrary(shop);
  const matching = library.filter(quiz => !layout || (quiz.layout || "three") === layout);
  let selected = matching.find(quiz => quiz.handle === code || (code && quiz.legacyHandles?.includes(code)));
  if (!selected && (!code || code === "dosha-quiz") && matching.length === 1) selected = matching[0];
  if (!selected) {
    const type = layout === "scan" ? "AI Skin Scan" : layout === "single" ? "Single Quiz" : "Combined Quiz";
    return apiJson({ error: matching.length ? `Paste the widget code of your ${type} from All quizzes.` : `Create an ${type} in the app first. It will appear here after you connect it.` }, { status: 404 });
  }
  try {
    return apiJson({ ...await publicQuiz(shop, selected.handle), handle: selected.handle, scanAppearance: await loadScanAppearance(shop), scanProvider: PROVIDER_NAMES[provider], scanReady: provider === "openai" && await hasOpenAIKey(shop) });
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : "Quiz is not ready yet." }, { status: 422 });
  }
};