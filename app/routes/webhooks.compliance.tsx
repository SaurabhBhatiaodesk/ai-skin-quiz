import { deleteScanAppearance } from "../scan-appearance.server";
import { deleteOpenAIKey } from "../settings.server";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { clearProductCache, deleteShopQuizzes } from "../quiz.server";
import { countReports, deleteReports } from "../report.server";
import { deleteShopSetup } from "../setup.server";

// Mandatory privacy webhooks: customers/data_request, customers/redact and shop/redact.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const email = typeof payload?.customer?.email === "string" ? payload.customer.email : "";

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      // Quiz reports hold the customer's email, dosha result and recommended products for at most 7 days.
      const reports = email ? await countReports(shop, email) : 0;
      console.log(`Customer data request for ${shop}: ${reports} stored quiz report(s).`);
      break;
    }
    case "CUSTOMERS_REDACT":
      if (email) await deleteReports(shop, email);
      break;
    case "SHOP_REDACT":
      await deleteReports(shop);
      await deleteShopQuizzes(shop);
      await deleteShopSetup(shop);
      await deleteScanAppearance(shop);
      await deleteOpenAIKey(shop);
      // Scan provider settings (table created by the Global Settings page, if it has been used).
      await db.$executeRawUnsafe("DELETE FROM GlobalSettings WHERE shop=?", shop).catch(() => undefined);
      clearProductCache(shop);
      await db.session.deleteMany({ where: { shop } });
      break;
    default:
      console.log(`Unhandled compliance webhook ${topic} for ${shop}`);
  }

  return new Response();
};
