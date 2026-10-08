import prisma from "./db.server";
export const scanAppearanceDefaults = { enabled: true, shape: "rounded", label: "Skin Scan", position: "right", buttonColor: "#ee5368", buttonTextColor: "#ffffff", panelColor: "#faf7f2", textColor: "#1a1208", accentColor: "#8f6330", radius: 32, offset: 24 };
export type ScanAppearance = typeof scanAppearanceDefaults;
async function prepare() { await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS ScanAppearance (shop TEXT PRIMARY KEY, payload TEXT NOT NULL)"); }
export function normalizeAppearance(value: unknown): ScanAppearance {
  const input = value as Partial<ScanAppearance>;
  const result = { ...scanAppearanceDefaults };
  result.enabled = input?.enabled !== false;
  result.shape = input?.shape === "circle" ? "circle" : "rounded";
  result.label = String(input?.label || "Skin Scan").trim().slice(0, 40) || "Skin Scan";
  result.position = input?.position === "left" ? "left" : "right";
  for (const key of ["buttonColor", "buttonTextColor", "panelColor", "textColor", "accentColor"] as const) {
    if (input?.[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(input[key]!)) throw new Error("Choose a valid color.");
    result[key] = input?.[key] || result[key];
  }
  for (const key of ["radius", "offset"] as const) {
    const number = Number(input?.[key] ?? result[key]);
    if (!Number.isFinite(number) || number < 0 || number > 64) throw new Error("Spacing and corners must be between 0 and 64 pixels.");
    result[key] = number;
  }
  return result;
}
export async function loadScanAppearance(shop: string) {
  await prepare();
  const rows = await prisma.$queryRawUnsafe<Array<{payload: string}>>("SELECT payload FROM ScanAppearance WHERE shop=?", shop);
  return normalizeAppearance(rows[0] ? JSON.parse(rows[0].payload) : {});
}
export async function saveScanAppearance(shop: string, value: unknown) {
  const appearance = normalizeAppearance(value);
  await prepare();
  await prisma.$executeRawUnsafe("INSERT INTO ScanAppearance (shop,payload) VALUES (?,?) ON CONFLICT(shop) DO UPDATE SET payload=excluded.payload", shop, JSON.stringify(appearance));
  return appearance;
}

export async function deleteScanAppearance(shop: string) {
  await prepare();
  await prisma.$executeRawUnsafe("DELETE FROM ScanAppearance WHERE shop=?", shop);
}
