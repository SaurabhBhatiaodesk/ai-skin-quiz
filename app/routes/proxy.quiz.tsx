import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { publicQuiz } from "../quiz.server";

function shopFrom(request: Request, shop?: string) {
  return shop || new URL(request.url).searchParams.get("shop") || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const code = new URL(request.url).searchParams.get("code");
  return Response.json(await publicQuiz(shopFrom(request, session?.shop), code));
};
