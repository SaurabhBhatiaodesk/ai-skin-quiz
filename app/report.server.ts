import { randomUUID } from "node:crypto";
import prisma from "./db.server";
import type { QuizResult } from "./quiz.server";

async function prepare() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS QuizReport (id TEXT PRIMARY KEY, shop TEXT NOT NULL, payload TEXT NOT NULL, email TEXT, sent INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL)`);
  await prisma.$executeRawUnsafe("DELETE FROM QuizReport WHERE expires < ?", Date.now());
}
export function publicReport(result: QuizResult, id: string, unlocked = false) {
  const locked = result.source === "Deep Dosha" && !unlocked;
  return { ...result, reportId: id, locked, profile: locked ? { ...result.profile, essence: "Enter your email to unlock your full Prakriti analysis.", insight: "", products: [] } : result.profile, insight: locked ? "" : result.insight, products: locked ? [] : result.products };
}
export async function storeReport(shop: string, result: QuizResult) {
  await prepare();
  const id = randomUUID();
  await prisma.$executeRawUnsafe("INSERT INTO QuizReport (id,shop,payload,expires) VALUES (?,?,?,?)", id, shop, JSON.stringify(result), Date.now() + 7 * 86400000);
  return publicReport(result, id);
}
export async function unlockReport(shop: string, id: unknown, email: unknown) {
  if (typeof id !== "string" || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  await prepare();
  const rows = await prisma.$queryRawUnsafe<Array<{payload:string; email:string|null; sent:number}>>("SELECT payload,email,sent FROM QuizReport WHERE id=? AND shop=? AND expires>?", id, shop, Date.now());
  const row = rows[0];
  if (!row) throw new Error("This result has expired. Please retake the quiz.");
  const address = email.trim().toLowerCase();
  if (row.email && row.email !== address) throw new Error("This report is already linked to another email. Please retake the quiz.");
  await prisma.$executeRawUnsafe("UPDATE QuizReport SET email=? WHERE id=? AND shop=?", address, id, shop);
  const result = JSON.parse(row.payload) as QuizResult;
  let delivery = row.sent ? "queued" : "not_configured";
  if (!row.sent && process.env.KLAVIYO_PRIVATE_API_KEY && process.env.KLAVIYO_SHOP === shop) {
    const response = await fetch("https://a.klaviyo.com/api/events", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`, "Content-Type": "application/json", revision: "2026-04-15" },
      body: JSON.stringify({ data: { type: "event", attributes: { unique_id: id, properties: { dosha: result.dosha, percentages: result.percentages, source: result.source, report: result.insight, products: result.products }, metric: { data: { type: "metric", attributes: { name: "Prakriti Report Unlocked" } } }, profile: { data: { type: "profile", attributes: { email: address } } } } } }),
    }).catch(() => null);
    if (response?.ok) { await prisma.$executeRawUnsafe("UPDATE QuizReport SET sent=1 WHERE id=? AND shop=?", id, shop); delivery = "queued"; }
    else delivery = "failed";
  }
  return { result: publicReport(result, id, true), delivery };
}