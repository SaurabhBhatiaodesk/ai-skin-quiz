import prisma from "./db.server";

// Remembers per shop that the quiz was activated in the theme, so the setup prompts are shown only once.
async function ensureSetupTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "QuizShopSetup" ("shop" TEXT NOT NULL PRIMARY KEY, "themeActivatedAt" INTEGER)`);
}

export async function isThemeActivated(shop: string) {
  await ensureSetupTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ themeActivatedAt: number | bigint | null }>>(
    `SELECT "themeActivatedAt" FROM "QuizShopSetup" WHERE "shop" = ? LIMIT 1`,
    shop,
  );
  return Boolean(rows[0]?.themeActivatedAt);
}

export async function markThemeActivated(shop: string) {
  await ensureSetupTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuizShopSetup" ("shop", "themeActivatedAt") VALUES (?, ?)
     ON CONFLICT("shop") DO UPDATE SET "themeActivatedAt" = COALESCE("QuizShopSetup"."themeActivatedAt", excluded."themeActivatedAt")`,
    shop,
    Date.now(),
  );
}

export async function deleteShopSetup(shop: string) {
  await ensureSetupTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "QuizShopSetup" WHERE "shop" = ?`, shop);
}
