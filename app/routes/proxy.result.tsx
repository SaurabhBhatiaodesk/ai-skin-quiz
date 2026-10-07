import { scanResult } from "../scan.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { buildQuizResult, loadQuiz } from "../quiz.server";
import { storeReport, unlockReport } from "../report.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  return Response.json({ ok: false, error: "Use POST to score a quiz." }, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  const shop = session?.shop || new URL(request.url).searchParams.get("shop") || "";
  if (Number(request.headers.get("content-length") || 0) > 7500000) return Response.json({ ok: false, error: "Photo too large." }, { status: 413 });
  const submission = await request.json().catch(() => null);
  if (!submission || typeof submission !== "object") return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  try {
    if (submission.intent === "unlock") return Response.json({ ok: true, ...await unlockReport(shop, submission.reportId, submission.email) });
    if (!["quick", "deep", "scan"].includes(submission.path)) throw new Error("Choose a valid quiz path.");
    if (submission.path !== "scan") {
      const quiz = await loadQuiz(shop, submission.code);
      if (quiz.emailCapture?.enabled && !quiz.emailCapture.allowSkip && !submission.email) throw new Error("Enter your email to see your ritual.");
      if (submission.email && (typeof submission.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email) || submission.email.length > 254)) throw new Error("Enter a valid email address.");
      const questions = submission.path === "deep" ? quiz.deep : quiz.quick;
      if (!questions.length || !submission.answers || questions.some((question, index) => {
        const value = submission.answers[index];
        return !Number.isInteger(value) || value < 0 || value >= question.options.length;
      })) throw new Error("Please answer every question before submitting.");
    }
    const result = await storeReport(shop, (submission.path === "scan" ? await scanResult(submission, shop, admin) : await buildQuizResult(submission, shop, admin)));
    if (submission.email) { const unlocked = await unlockReport(shop, result.reportId, submission.email); return Response.json({ ok: true, result: unlocked.result, delivery: unlocked.delivery }); }
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Could not complete this quiz." }, { status: 422 });
  }
};
