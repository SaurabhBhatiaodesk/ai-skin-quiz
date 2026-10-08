import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadLibrary } from "../quiz.server";
import template from "../../extensions/dosha-quiz/snippets/quiz-widget.liquid?raw";
import stylesheet from "../../extensions/dosha-quiz/assets/dosha-quiz.css?raw";
// Vite ?raw exposes the classic browser bundle as a string.
// eslint-disable-next-line import/default
import widgetScript from "../../extensions/dosha-quiz/assets/dosha-quiz.js?raw";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const params = new URL(request.url).searchParams;
  const shop = session?.shop || params.get("shop") || "";
  const quiz = (await loadLibrary(shop)).find(item => item.handle === params.get("code"));
  if (!quiz) return new Response("Quiz not found. Check its widget code.", { status: 404 });
  const values: Record<string, string> = {
    "block.id": `embed-${quiz.handle}`,
    "expected_layout": quiz.layout || "three",
    "request.design_mode": "false",
    "block.settings.quiz_code": quiz.handle,
    "block.settings.brand_name": quiz.name,
    "block.settings.hero_title": "Find Your",
    "block.settings.hero_accent": "Skin Ritual",
    "block.settings.hero_subtitle": quiz.layout === "single" ? "Your personal skin ritual." : quiz.layout === "scan" ? "AI Skin Scan" : "Three paths. Your personal skin ritual.",
    "block.settings.privacy_url": "/policies/privacy-policy",
  };
  const markup = template.replace(/\{% if request.design_mode %\}[\s\S]*?\{% endif %\}/g, "")
    .replace(/\{\{\s*([^}|]+)(?:\|[^}]+)?\}\}/g, (_, key: string) => escapeHtml(values[key.trim()] || ""));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"><style>html,body{margin:0;padding:0}${stylesheet} .prana-quiz,.prana-quiz .screen{min-height:0}</style></head><body>${markup}<script>${widgetScript}</script><script>new ResizeObserver(function(){parent.postMessage({type:'prana-widget-height',height:document.body.scrollHeight},location.origin)}).observe(document.body);</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
};