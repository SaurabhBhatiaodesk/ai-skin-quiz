import prisma from "./db.server";

// Remembers per shop that the quiz was activated in the theme, so the setup prompts are shown only once.
async function ensureSetupTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "QuizShopSetup" ("shop" TEXT NOT NULL PRIMARY KEY, "themeActivatedAt" INTEGER)`);
}

export async function isThemeActivated(shop: string) {
  await ensureSetupTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ activated: number | bigint }> >(
    `SELECT CASE WHEN "themeActivatedAt" IS NOT NULL AND "themeActivatedAt" > 0 THEN 1 ELSE 0 END AS "activated" FROM "QuizShopSetup" WHERE "shop" = ? LIMIT 1`,
    shop,
  );
  return Number(rows[0]?.activated || 0) === 1;
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
