import { readBoundedJson } from "../request-body.server";
import { scanResult } from "../scan.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { buildQuizResult, loadQuiz } from "../quiz.server";
import { storeReport, unlockReport } from "../report.server";

function apiJson(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store" } });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  return apiJson({ ok: false, error: "Use POST to score a quiz." }, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  const shop = session?.shop || new URL(request.url).searchParams.get("shop") || "";
  let submission;
  try { submission = await readBoundedJson(request); }
  catch (error) { const tooLarge = error instanceof Error && error.message === "Photo too large."; return apiJson({ ok: false, error: tooLarge ? "Photo too large." : "Invalid request." }, { status: tooLarge ? 413 : 400 }); }
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) return apiJson({ ok: false, error: "Invalid request." }, { status: 400 });
  try {
    if (submission.email && (typeof submission.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email) || submission.email.length > 254)) throw new Error("Enter a valid email address.");
    if (submission.intent === "unlock") return apiJson({ ok: true, ...await unlockReport(shop, submission.reportId, submission.email) });
    if (!(typeof submission.code === "string" && submission.code.trim()) && !(typeof submission.code === "number" && Number.isSafeInteger(submission.code) && submission.code > 0)) throw new Error("Provide this widget ID in code.");
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
    if (submission.email) { const unlocked = await unlockReport(shop, result.reportId, submission.email); return apiJson({ ok: true, result: unlocked.result, delivery: unlocked.delivery }); }
    return apiJson({ ok: true, result });
  } catch (error) {
    return apiJson({ ok: false, error: error instanceof Error ? error.message : "Could not complete this quiz." }, { status: 422 });
  }
};
