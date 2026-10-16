// Assets for the admin Quiz design preview: the same widget markup, stylesheet and runtime the storefront uses,
// so the preview renders exactly like the theme block (fonts aside, which come from the merchant's theme).
import template from "../extensions/dosha-quiz/snippets/quiz-widget.liquid?raw";
import stylesheet from "../extensions/dosha-quiz/assets/dosha-quiz.css?raw";
// Vite ?raw exposes the classic browser bundle as a string.
// eslint-disable-next-line import/default
import script from "../extensions/dosha-quiz/assets/dosha-quiz-runtime.js?raw";
import { DEFAULT_CARD_ICONS } from "./quiz.server";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function widgetPreviewAssets(quiz: { handle: string; name?: string; layout?: string }) {
  const layout = quiz.layout || "three";
  const values: Record<string, string> = {
    "block.id": "admin-preview",
    "expected_layout": layout,
    "request.design_mode": "false",
    "block.settings.quiz_code": quiz.handle,
    "block.settings.brand_name": quiz.name || "",
    "block.settings.hero_title": "Find Your",
    "block.settings.hero_accent": "Skin Ritual",
    "block.settings.hero_subtitle": layout === "single" ? "Your personal skin ritual." : layout === "scan" ? "AI Skin Scan" : "Three paths. One result. Your personal ritual.",
    "block.settings.privacy_url": "#",
  };
  const markup = template.replace(/\{% if request.design_mode %\}[\s\S]*?\{% endif %\}/g, "")
    .replace(/\{\{\s*([^}|]+)(?:\|[^}]+)?\}\}/g, (_, key: string) => escapeHtml(values[key.trim()] || ""));
  return { markup, stylesheet, script, cardIcons: DEFAULT_CARD_ICONS, rootId: "prana-quiz-admin-preview" };
}
export type WidgetPreviewAssets = ReturnType<typeof widgetPreviewAssets>;
