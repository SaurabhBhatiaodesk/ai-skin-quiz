// Stage the app embed as enabled; Shopify persists it when the merchant saves.
export function skinScanActivationUrl(shop: string) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) throw new Error("SHOPIFY_API_KEY is required for app embed activation.");
  const url = new URL(`https://${shop}/admin/themes/current/editor`);
  url.searchParams.set("context", "apps");
  url.searchParams.set("template", "index");
  url.searchParams.set("activateAppId", `${apiKey}/scan-assistant`);
  return url.toString();
}
