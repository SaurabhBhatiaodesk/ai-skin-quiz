import { asProvider } from "./ai-shared";
import type { AIProvider } from "./ai-shared";
export { asProvider, PROVIDER_NAMES } from "./ai-shared";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import prisma from "./db.server";
export type ProviderSettings = { provider: string; endpoint: string; documentation: string };
const defaults: ProviderSettings = { provider: "OpenAI", endpoint: "https://api.openai.com/v1/responses", documentation: "https://developers.openai.com/api/docs/guides/images-vision" };
async function prepare() {
  await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS GlobalSettings (shop TEXT PRIMARY KEY, payload TEXT NOT NULL)");
}
export async function loadProviderSettings(shop: string): Promise<ProviderSettings> {
  await prepare();
  const rows = await prisma.$queryRawUnsafe<Array<{payload: string}>>("SELECT payload FROM GlobalSettings WHERE shop=?", shop);
  return rows[0] ? JSON.parse(rows[0].payload) : defaults;
}
export async function saveProviderSettings(shop: string, value: unknown) {
  const input = value as Partial<ProviderSettings>;
  const settings = { provider: String(input?.provider || "").trim(), endpoint: String(input?.endpoint || "").trim(), documentation: String(input?.documentation || "").trim() };
  if (!settings.provider || settings.provider.length > 80) throw new Error("Enter a provider name under 80 characters.");
  if (/sk-|api.?key|bearer/i.test(settings.provider)) throw new Error("Enter a provider name, not an API key. Keep secrets in the server environment.");
  for (const value of [settings.endpoint, settings.documentation]) {
    if (!value) continue;
    const url = new URL(value);
    if (value.length > 500 || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Use an HTTPS URL without credentials, query parameters or fragments.");
  }
  await prepare();
  await prisma.$executeRawUnsafe("INSERT INTO GlobalSettings (shop,payload) VALUES (?,?) ON CONFLICT(shop) DO UPDATE SET payload=excluded.payload", shop, JSON.stringify(settings));
  return settings;
}

function encryptionKey(shop: string) {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("Server encryption is not configured. Contact your developer.");
  return scryptSync(secret, `prana-openai-key:${shop}`, 32);
}
async function prepareKeys() {
  await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS OpenAICredentials (shop TEXT PRIMARY KEY, encrypted TEXT NOT NULL)");
}
export async function hasOpenAIKey(shop: string) {
  await prepareKeys();
  const rows = await prisma.$queryRawUnsafe<Array<{encrypted: string}>>("SELECT encrypted FROM OpenAICredentials WHERE shop=?", shop);
  return Boolean(rows.length || (process.env.OPENAI_API_KEY && process.env.OPENAI_SHOP === shop));
}
export async function saveOpenAIKey(shop: string, value: unknown) {
  if (typeof value !== "string" || !/^sk-[A-Za-z0-9_-]{20,500}$/.test(value.trim())) throw new Error("Enter a valid OpenAI API key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(shop), iv);
  const ciphertext = Buffer.concat([cipher.update(value.trim(), "utf8"), cipher.final()]);
  const encrypted = [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
  await prepareKeys();
  await prisma.$executeRawUnsafe("INSERT INTO OpenAICredentials (shop,encrypted) VALUES (?,?) ON CONFLICT(shop) DO UPDATE SET encrypted=excluded.encrypted", shop, encrypted);
}
// Server-only: never return this value from a loader or log it.
export async function getOpenAIKey(shop: string) {
  await prepareKeys();
  const rows = await prisma.$queryRawUnsafe<Array<{encrypted: string}>>("SELECT encrypted FROM OpenAICredentials WHERE shop=?", shop);
  if (!rows[0]) return process.env.OPENAI_SHOP === shop ? process.env.OPENAI_API_KEY : undefined;
  const [iv, tag, payload] = rows[0].encrypted.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(shop), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
}
export async function deleteOpenAIKey(shop: string) {
  await prepareKeys();
  await prisma.$executeRawUnsafe("DELETE FROM OpenAICredentials WHERE shop=?", shop);
  await prepareAI();
  await prisma.$executeRawUnsafe("DELETE FROM AICredentials WHERE shop=?", shop);
  await prisma.$executeRawUnsafe("DELETE FROM AISelection WHERE shop=?", shop);
}

async function prepareAI() {
  await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS AICredentials (shop TEXT NOT NULL, provider TEXT NOT NULL, encrypted TEXT NOT NULL, PRIMARY KEY(shop,provider))");
  await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS AISelection (shop TEXT PRIMARY KEY, provider TEXT NOT NULL)");
}
export async function selectedProvider(shop: string): Promise<AIProvider> {
  await prepareAI();
  const rows = await prisma.$queryRawUnsafe<Array<{provider: string}>>("SELECT provider FROM AISelection WHERE shop=?", shop);
  return rows[0] ? asProvider(rows[0].provider) : "openai";
}
export async function providerHasKey(shop: string, provider: AIProvider) {
  if (provider === "openai") return hasOpenAIKey(shop);
  await prepareAI();
  const rows = await prisma.$queryRawUnsafe<Array<{encrypted:string}>>("SELECT encrypted FROM AICredentials WHERE shop=? AND provider=?",shop,provider);
  return Boolean(rows.length);
}
export async function saveAIProvider(shop: string, provider: AIProvider, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    if (provider === "openai") await saveOpenAIKey(shop,value);
    else {
      const key = value.trim();
      if (key.length < 20 || key.length > 500 || /\s/.test(key)) throw new Error("Enter a valid provider API key.");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm",encryptionKey(shop),iv);
      cipher.setAAD(Buffer.from(provider));
      const encrypted = [iv.toString("base64"),cipher.getAuthTag().toString("base64"),Buffer.concat([cipher.update(key,"utf8"),cipher.final()]).toString("base64")].join(".");
      await prepareAI();
      await prisma.$executeRawUnsafe("INSERT INTO AICredentials (shop,provider,encrypted) VALUES (?,?,?) ON CONFLICT(shop,provider) DO UPDATE SET encrypted=excluded.encrypted",shop,provider,encrypted);
    }
  }
  if (!await providerHasKey(shop,provider)) throw new Error("Add an API key for the selected provider first.");
  await prepareAI();
  await prisma.$executeRawUnsafe("INSERT INTO AISelection (shop,provider) VALUES (?,?) ON CONFLICT(shop) DO UPDATE SET provider=excluded.provider",shop,provider);
}
export async function getAIKey(shop: string, provider: AIProvider) {
  if(provider === "openai") return getOpenAIKey(shop);
  await prepareAI();
  const rows = await prisma.$queryRawUnsafe<Array<{encrypted:string}>>("SELECT encrypted FROM AICredentials WHERE shop=? AND provider=?",shop,provider);
  if(!rows[0]) return undefined;
  const [iv,tag,payload] = rows[0].encrypted.split(".");
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(shop),Buffer.from(iv,"base64"));
  decipher.setAAD(Buffer.from(provider)); decipher.setAuthTag(Buffer.from(tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload,"base64")),decipher.final()]).toString("utf8");
}
