import { asProvider, PROVIDER_NAMES } from "../ai-shared";
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getAIKey, providerHasKey, saveAIProvider, selectedProvider } from "../settings.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const provider = await selectedProvider(session.shop);
  return { provider, keys: { openai: await providerHasKey(session.shop,"openai"), gemini: await providerHasKey(session.shop,"gemini"), claude: await providerHasKey(session.shop,"claude") } };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try {
    const input = await request.json();
    const provider = asProvider(input.provider);
    if (input.intent === "test") {
      if (provider !== "openai") throw new Error("Photo provider connection is pending authorization and adapter setup.");
      const key = await getAIKey(session.shop,provider);
      if (!key) throw new Error("No API key is saved for this store.");
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_SCAN_MODEL || "gpt-4.1-mini", input: "Reply OK.", max_output_tokens: 16, store: false }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(response.status === 401 ? "The saved API key is invalid." : failure?.error?.code === "insufficient_quota" ? "Your OpenAI project has no API credits. Add billing credits in OpenAI to run scans." : response.status === 429 ? "OpenAI is rejecting analysis requests with HTTP 429. Check project billing and usage limits, or retry after the rate limit resets." : `OpenAI analysis request failed (HTTP ${response.status}).`);
      }
      return { ok: false, connected: true, error: "" };
    }
    await saveAIProvider(session.shop, provider, input.apiKey);
    return { ok: true, error: "" };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save API key." }; }
}
export default function GlobalSettings() {
  const data = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState(data.provider);
  const providerName = PROVIDER_NAMES[provider];
  const [apiKey, setApiKey] = useState("");
  const [changing, setChanging] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const fetcher = useFetcher<typeof action>();
  const keySaved = data.keys[provider];
  const testing = Boolean(fetcher.json && typeof fetcher.json === "object" && !Array.isArray(fetcher.json) && "intent" in fetcher.json && fetcher.json.intent === "test");
  useEffect(() => { if (fetcher.data?.ok) { setApiKey(""); setChanging(false); setVisible(false); setCopyStatus(""); } }, [fetcher.data]);
  return <s-page heading="Global Settings" inlineSize="large">
    <s-button slot="primary-action" variant="primary" disabled={(!keySaved || changing) && !apiKey.trim()} loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ apiKey, provider }, { method: "POST", encType: "application/json" })}>{changing ? "Replace API key" : "Save provider"}</s-button>
    <s-button slot="secondary-actions" disabled={!keySaved} loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ intent: "test", provider }, { method: "POST", encType: "application/json" })}>Test connection</s-button>
    <s-link slot="breadcrumb-actions" href="/app/quizzes">Back</s-link>
    <s-button slot="secondary-actions" href="/app/scan-appearance">Skin Scan appearance</s-button>
    <s-section heading="AI provider">
      <s-icon slot="graphic" type="connect" />
      <s-badge slot="supplemental" tone={keySaved ? "success" : "warning"} icon={keySaved ? "check-circle" : "alert-triangle"}>{keySaved ? "API key saved" : "API key not added"}</s-badge>
      <s-stack gap="base">
        <s-select label="AI provider" value={provider} onChange={event => { setProvider(asProvider(event.currentTarget.value)); setApiKey(""); setChanging(false); setVisible(false); }}><s-option value="openai">OpenAI</s-option><s-option value="gemini">Gemini (Google)</s-option><s-option value="claude">Claude (Anthropic)</s-option></s-select>
        <s-paragraph>{keySaved ? "Your API key is saved securely. You do not need to enter it again." : `Paste your ${providerName} API key below and save.`}</s-paragraph>
        {fetcher.state !== "idle" ? <s-stack gap="small-200"><s-text>{testing ? "Testing connection" : "Saving provider"}</s-text><s-progress accessibilityLabel={testing ? "Testing AI provider connection" : "Saving AI provider settings"} /></s-stack> : null}
        {fetcher.data?.error ? <s-banner tone="critical" heading="Action could not be completed">{fetcher.data.error}</s-banner> : null}
        {fetcher.data && "connected" in fetcher.data && fetcher.data.connected ? <s-banner tone="success" heading="Connection verified">Photo analysis can use this saved key.</s-banner> : null}
        {fetcher.data?.ok && !("connected" in fetcher.data) ? <s-banner tone="success" heading="Provider saved">Your API key is stored securely.</s-banner> : null}
        {keySaved && !changing ? <s-stack gap="base">
          <s-text-field label={`Saved ${providerName} API key`} value="????????????????" readOnly />
          <s-stack direction="inline"><s-button onClick={() => setChanging(true)}>Change API key</s-button></s-stack>
        </s-stack> : <s-stack gap="base">
        {visible ? <s-text-field label={keySaved ? "Replace API key (optional)" : `${providerName} API key`} value={apiKey} onInput={event => { setApiKey(event.currentTarget.value); setCopyStatus(""); }} /> : <s-password-field label={keySaved ? "Replace API key (optional)" : `${providerName} API key`} value={apiKey} onInput={event => { setApiKey(event.currentTarget.value); setCopyStatus(""); }} />}
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</s-button>
          <s-button disabled={!apiKey} onClick={async () => { try { await navigator.clipboard.writeText(apiKey); setCopyStatus("Copied"); } catch { setCopyStatus("Could not copy"); } }}>Copy</s-button>
          {copyStatus ? <s-text>{copyStatus}</s-text> : null}
        </s-stack>
          {keySaved ? <s-stack direction="inline"><s-button onClick={() => { setChanging(false); setApiKey(""); setVisible(false); }}>Cancel</s-button></s-stack> : null}
        </s-stack>}

        <s-stack direction="inline"><s-button disabled={!keySaved} loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ intent: "test", provider }, { method: "POST", encType: "application/json" })}>Test connection</s-button></s-stack>
        <s-paragraph color="subdued">Saved keys are encrypted and are not displayed again. Enter a new key here to replace it.</s-paragraph>
        {provider !== "openai" ? <s-banner tone="warning" heading="Photo integration pending">You can save this provider key. Gemini and Claude scanning will be enabled after photo-processing approval and integration verification.</s-banner> : null}
        <s-paragraph color="subdued">Skin Scan uses the selected AI provider to describe visible cosmetic skin concerns. Customers must consent before their photo is sent.</s-paragraph>
        <s-link href={provider === "openai" ? "https://platform.openai.com/api-keys" : provider === "gemini" ? "https://aistudio.google.com/api-keys" : "https://console.anthropic.com/settings/keys"} target="_blank">Get {providerName} API key</s-link>
        <s-stack direction="inline" justifyContent="end"><s-button variant="primary" disabled={(!keySaved || changing) && !apiKey.trim()} loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ apiKey, provider }, { method: "POST", encType: "application/json" })}>{changing ? "Replace API key" : "Save provider"}</s-button></s-stack>
      </s-stack>
    </s-section>
  </s-page>;
}
export const headers: HeadersFunction = args => boundary.headers(args);
