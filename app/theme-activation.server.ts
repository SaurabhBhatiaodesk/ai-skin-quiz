// Open the embed settings and request activation in the same navigation.
// Shopify persists the enabled state when the merchant clicks Save.
export function skinScanActivationUrl(shop: string) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) throw new Error("SHOPIFY_API_KEY is required for app embed activation.");
  const store = shop.replace(/\.myshopify\.com$/, "");
  const embed = `${encodeURIComponent(apiKey)}/scan-assistant`;
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/themes/current/editor?context=apps&template=index&appEmbed=${embed}&activateAppId=${embed}`;
}
