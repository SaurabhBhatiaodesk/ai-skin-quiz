import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureNumericWidgetId, loadQuiz, loadStoreProducts, saveQuiz } from "../quiz.server";
import { providerHasKey, selectedProvider } from "../settings.server";
import QuizEditor from "../components/QuizEditor";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, redirect } = await authenticate.admin(request);
  const code = new URL(request.url).searchParams.get("quiz");
  if (!code?.trim()) return redirect("/app/quizzes");
  await ensureNumericWidgetId(session.shop, code);
  const quiz = await loadQuiz(session.shop, code);
  let products: Awaited<ReturnType<typeof loadStoreProducts>> = [];
  let productsError = false;
  try {
    products = await loadStoreProducts(admin);
  } catch (error) {
    console.error("Editor product load failed", session.shop, error);
    productsError = true;
  }
  const scanConfigured = await selectedProvider(session.shop) === "openai" && await providerHasKey(session.shop, "openai");
  return { shop: session.shop, quiz, products, productsError, scanConfigured };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  try {
    const code = new URL(request.url).searchParams.get("quiz");
    const quiz = await saveQuiz(session.shop, await request.json(), code);
    return { ok: true as const, quiz };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not save the quiz.",
    };
  }
};

export default function Index() {
  const { shop, quiz, products, productsError, scanConfigured } = useLoaderData<typeof loader>();
  return <QuizEditor initial={quiz} shop={shop} products={products} productsError={productsError} scanConfigured={scanConfigured} code={quiz.handle} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
