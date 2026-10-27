// Detailed dosha report email (the same reading the shopper unlocked): profile, signs, ritual, usage guide and the
// recommended products. Sent through Resend when RESEND_API_KEY and REPORT_FROM_EMAIL are set on the server.
import type { QuizResult } from "./quiz.server";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const list = (items: string[] | undefined) => (items && items.length ? `<ul style="margin:6px 0 0;padding-left:18px">${items.map((item) => `<li style="margin:4px 0">${escape(item)}</li>`).join("")}</ul>` : "");
const section = (title: string, body: string) => (body ? `<h3 style="margin:26px 0 6px;font:600 13px/1.3 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a5a22">${escape(title)}</h3>${body}` : "");

export function reportEmailHtml(result: QuizResult, storeUrl: string) {
  const guide = result.guide;
  const name = result.profile?.name || guide?.displayName || "Your dosha";
  const percentages = result.percentages ? Object.entries(result.percentages).map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)} ${value}%`).join("  ·  ") : "";
  const products = (result.products || []).map((product) => {
    const url = `${storeUrl}/products/${encodeURIComponent(product.handle)}`;
    return `<tr><td style="padding:10px 0;border-top:1px solid #eee">${product.image ? `<img src="${escape(product.image)}" width="56" height="56" alt="" style="border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:12px">` : ""}<a href="${escape(url)}" style="color:#111;font-weight:600;text-decoration:none">${escape(product.title)}</a><div style="color:#7a6f66;font-size:13px;margin-top:2px">${escape(product.why)}${product.price ? " · " + escape(product.price) : ""}</div></td></tr>`;
  }).join("");
  const usage = guide?.usage?.length ? `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${guide.usage.map((row) => `<tr><td style="padding:10px 0;border-top:1px solid #eee;vertical-align:top"><strong>${escape(row.product)}</strong><div style="color:#8a5a22;font-size:13px;margin:2px 0">${escape(row.when)}</div><div style="color:#444">${escape(row.how)}</div></td></tr>`).join("")}</table>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f1ea"><div style="max-width:620px;margin:0 auto;padding:28px 22px;background:#ffffff;font:15px/1.6 Georgia,'Times New Roman',serif;color:#1a1208">
  <div style="font:600 12px Arial,sans-serif;letter-spacing:.16em;color:#8a5a22;text-transform:uppercase">Your Dosha Report</div>
  <h1 style="margin:8px 0 4px;font-size:34px;font-weight:400">${escape(name)}</h1>
  <div style="color:#7a6f66">${escape(guide?.element || result.profile?.sub || "")}</div>
  ${guide?.tagline ? `<p style="font-size:19px;font-style:italic;margin:16px 0">${escape(guide.tagline)}</p>` : ""}
  ${percentages ? `<p style="font:13px Arial,sans-serif;color:#7a6f66">${escape(percentages)}</p>` : ""}
  ${section("Your skin's signature", guide?.signature ? `<p style="margin:0">${escape(guide.signature)}</p>` : "")}
  ${section("Ingredient allies", guide?.allies?.length ? `<p style="margin:0">${guide.allies.map(escape).join("  ·  ")}</p>` : "")}
  ${section("Skin profile", guide?.profile ? `<p style="margin:0">${escape(guide.profile)}</p>` : "")}
  ${section("Signs of balance", list(guide?.balance))}
  ${section("Signs of imbalance", list(guide?.imbalance))}
  ${section("Seasonal guidance", list(guide?.seasonal))}
  ${section("Your ritual", guide ? `<p style="margin:0"><strong>Morning:</strong> ${escape(guide.ritual.morning)}</p><p style="margin:8px 0 0"><strong>Night:</strong> ${escape(guide.ritual.night)}</p><p style="margin:8px 0 0"><strong>Weekly:</strong> ${escape(guide.ritual.weekly)}</p>${guide.ritual.key ? `<p style="margin:8px 0 0;color:#5a4f46"><strong>Key:</strong> ${escape(guide.ritual.key)}</p>` : ""}` : "")}
  ${section("How to use your products", usage)}
  ${section("Your ritual products", products ? `<table role="presentation" width="100%" style="border-collapse:collapse;font:14px Arial,sans-serif">${products}</table>` : "")}
  <p style="margin:30px 0 0;font:12px Arial,sans-serif;color:#9a8f86">Cosmetic guidance based on Ayurvedic principles, not a medical diagnosis.</p>
</div></body></html>`;
}

export function reportEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL);
}

// Returns true when the provider accepted the email.
export async function sendReportEmail(to: string, result: QuizResult, shop: string) {
  if (!reportEmailConfigured()) return false;
  const storeUrl = `https://${process.env.REPORT_STORE_DOMAIN || shop}`;
  const name = result.profile?.name || result.guide?.displayName || "dosha";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REPORT_FROM_EMAIL, to: [to], subject: `Your ${name} dosha report`, html: reportEmailHtml(result, storeUrl) }),
  }).catch(() => null);
  if (!response?.ok) console.error("Report email failed", { status: response?.status || "network_error" });
  return Boolean(response?.ok);
}
