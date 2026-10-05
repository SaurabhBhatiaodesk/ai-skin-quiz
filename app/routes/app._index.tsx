import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadQuiz, loadStoreProducts, saveQuiz } from "../quiz.server";
import QuizEditor from "../components/QuizEditor";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const code = new URL(request.url).searchParams.get("quiz");
  const quiz = await loadQuiz(session.shop, code);
  let products: Awaited<ReturnType<typeof loadStoreProducts>> = [];
  try {
    products = await loadStoreProducts(admin);
  } catch {
    products = [];
  }
  return { shop: session.shop, quiz, products, scanKeyPresent: Boolean(process.env.OPENAI_API_KEY) };
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
  const { shop, quiz, products, scanKeyPresent } = useLoaderData<typeof loader>();
  return <QuizEditor initial={quiz} shop={shop} products={products} code={quiz.handle} scanKeyPresent={scanKeyPresent} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
