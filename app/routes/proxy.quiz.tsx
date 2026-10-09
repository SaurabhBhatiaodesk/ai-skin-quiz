import { loadScanAppearance } from "../scan-appearance.server";
import { hasOpenAIKey, selectedProvider, PROVIDER_NAMES } from "../settings.server";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadLibrary, publicQuiz } from "../quiz.server";

function shopFrom(request: Request, shop?: string) {
  return shop || new URL(request.url).searchParams.get("shop") || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim();
  const layout = params.get("layout");
  const shop = shopFrom(request, session?.shop);
  const provider = await selectedProvider(shop);
  const library = await loadLibrary(shop);
  const matching = library.filter(quiz => !layout || (quiz.layout || "three") === layout);
  let selected = matching.find(quiz => quiz.handle === code || (code && quiz.legacyHandles?.includes(code)));
  if (!selected && (!code || code === "dosha-quiz") && matching.length === 1) selected = matching[0];
  if (!selected) {
    const type = layout === "scan" ? "AI Skin Scan" : layout === "single" ? "Single Quiz" : "Combined Quiz";
    return Response.json({ error: matching.length ? `Paste the widget code of your ${type} from All quizzes.` : `Create an ${type} in the app first. It will appear here after you connect it.` }, { status: 404 });
  }
  try {
    return Response.json({ ...await publicQuiz(shop, selected.handle), handle: selected.handle, scanAppearance: await loadScanAppearance(shop), scanProvider: PROVIDER_NAMES[provider], scanReady: provider === "openai" && await hasOpenAIKey(shop) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Quiz is not ready yet." }, { status: 422 });
  }
};