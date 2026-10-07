import { deleteOpenAIKey } from "../settings.server";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteReports } from "../report.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  // Customer emails and results are not kept after uninstall. Quiz setup stays until shop/redact,
  // so a merchant who reinstalls within 48 hours keeps their quizzes.
  await deleteReports(shop);
  await deleteOpenAIKey(shop);

  return new Response();
};
