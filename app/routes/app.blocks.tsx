import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Old address of the quiz list; kept so existing links keep working.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // The authenticated redirect keeps the embedded app's host and session parameters.
  const { redirect } = await authenticate.admin(request);
  const create = new URL(request.url).searchParams.get("create") === "1";
  return redirect(create ? "/app/quizzes/new" : "/app/quizzes");
};
