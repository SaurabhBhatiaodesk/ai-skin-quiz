// Renders the theme snippet (extensions/dosha-quiz/snippets/quiz-widget.liquid) outside Shopify, for the admin
// preview and the app-proxy embed. Supports only what the snippet uses: {{ value | filters }} lookups, the
// LiquidDoc header, the {% liquid %} assigns (their values come from `values`), design-mode and `!= blank` ifs.
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function renderWidgetTemplate(template: string, values: Record<string, string>) {
  return template
    .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}\s*/g, "")
    .replace(/\{%-?\s*liquid\b[\s\S]*?-?%\}\s*/g, "")
    .replace(/\{%-?\s*if request\.design_mode\s*-?%\}[\s\S]*?\{%-?\s*endif\s*-?%\}/g, "")
    .replace(/\{%-?\s*if\s+([\w.]+)\s*!=\s*blank\s*-?%\}([\s\S]*?)\{%-?\s*endif\s*-?%\}/g, (_, key: string, body: string) => (values[key] ? body : ""))
    .replace(/\{\{\s*([^}|]+)(?:\|[^}]+)?\}\}/g, (_, key: string) => escapeHtml(values[key.trim()] || ""));
}

export { escapeHtml };
