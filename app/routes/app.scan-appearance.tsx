import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadScanAppearance, saveScanAppearance } from "../scan-appearance.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return loadScanAppearance(session.shop);
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try { await saveScanAppearance(session.shop, await request.json()); return { ok: true, error: "" }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save appearance." }; }
}
export default function ScanAppearanceSettings() {
  const defaults = useLoaderData<typeof loader>();
  const [value, setValue] = useState(defaults);
  const fetcher = useFetcher<typeof action>();
  return <s-page heading="Skin Scan appearance">
    <s-link slot="breadcrumb-actions" href="/app/settings">Settings</s-link>
    <s-stack gap="base">
      {fetcher.data?.ok ? <s-banner tone="success">Appearance saved. Refresh your storefront to see the changes.</s-banner> : null}
      {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
      <s-section heading="Floating button">
        <s-stack gap="base">
          <s-paragraph>Applies to the Skin Scan button and popup across this store.</s-paragraph>
          <s-checkbox label="Show floating Skin Scan button" checked={value.enabled} onChange={event => setValue({ ...value, enabled: event.currentTarget.checked })} />
          <s-text-field label="Button text" value={value.label} onInput={event => setValue({ ...value, label: event.currentTarget.value })} />
          <s-select label="Position" value={value.position} onChange={event => setValue({ ...value, position: event.currentTarget.value })}><s-option value="right">Bottom right</s-option><s-option value="left">Bottom left</s-option></s-select>
          <s-select label="Button shape" value={value.shape} onChange={event => setValue({ ...value, shape: event.currentTarget.value })}><s-option value="rounded">Rounded button with text</s-option><s-option value="circle">Circle with scan icon</s-option></s-select>
          <label style={{ display: "grid", gap: 8 }}><span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>Rounded corners<output>{value.radius} px</output></span><input type="range" disabled={value.shape === "circle"} min="0" max="64" step="1" value={value.radius} onChange={event => setValue({ ...value, radius: Number(event.target.value) })} style={{ width: "100%", margin: 0, accentColor: "#29845a", cursor: "pointer" }} /></label>
          <label style={{ display: "grid", gap: 8 }}><span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>Distance from edge<output>{value.offset} px</output></span><input type="range" min="0" max="64" step="1" value={value.offset} onChange={event => setValue({ ...value, offset: Number(event.target.value) })} style={{ width: "100%", margin: 0, accentColor: "#29845a", cursor: "pointer" }} /></label>
        </s-stack>
      </s-section>
      <s-section heading="Colors">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {([["buttonColor", "Button background"], ["buttonTextColor", "Button text"], ["panelColor", "Popup background"], ["textColor", "Popup text"], ["accentColor", "Popup accent"]] as const).map(([key, label]) => <label key={key} style={{ display: "grid", gap: 8 }}>{label}<input type="color" value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} style={{ width: "100%", height: 36, cursor: "pointer" }} /></label>)}
        </div>
      </s-section>
      <s-section heading="Button preview">
        <div style={{ display: "flex", justifyContent: value.position === "left" ? "flex-start" : "flex-end", padding: 12, background: value.panelColor, borderRadius: 8 }}>
          <button type="button" style={{ background: value.buttonColor, color: value.buttonTextColor, borderRadius: value.shape === "circle" ? "50%" : value.radius, width: value.shape === "circle" ? 64 : undefined, height: value.shape === "circle" ? 64 : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, padding: value.shape === "circle" ? 0 : "18px 24px", font: "600 16px system-ui" }} aria-label={value.label || "Skin Scan"}>{value.shape === "circle" ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m10 0h2a2 2 0 0 0 2-2v-2M12 6c-2.5 0-4 2-4 4v2c0 3 1.8 6 4 6s4-3 4-6v-2c0-2-1.5-4-4-4ZM6 12h12M10 10h.01M14 10h.01" /></svg> : value.label || "Skin Scan"}</button>
        </div>
      </s-section>
      <s-stack direction="inline"><s-button variant="primary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit(value, { method: "post", encType: "application/json" })}>Save appearance</s-button></s-stack>
    </s-stack>
  </s-page>;
}
