import { defaultScanIcon } from "../default-scan-icon.js";
import UnsavedChangesBar from "../components/UnsavedChangesBar";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadScanAppearance, saveScanAppearance } from "../scan-appearance.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return { appearance: await loadScanAppearance(session.shop), embedUrl: `https://admin.shopify.com/store/${session.shop.replace(".myshopify.com", "")}/themes/current/editor?context=apps&activateAppId=${process.env.SHOPIFY_API_KEY || ""}/scan-assistant` };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try { await saveScanAppearance(session.shop, await request.json()); return { ok: true, error: "" }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save appearance." }; }
}
export default function ScanAppearanceSettings() {
  const { appearance: defaults, embedUrl } = useLoaderData<typeof loader>();
  const [value, setValue] = useState(defaults);
  const [savedValue, setSavedValue] = useState(defaults);
  const submittedValue = useRef(defaults);
  const [iconError, setIconError] = useState("");
  const fetcher = useFetcher<typeof action>();
  useEffect(() => { if (fetcher.data?.ok) setSavedValue(submittedValue.current); }, [fetcher.data]);
  function save() { submittedValue.current = value; fetcher.submit(value, { method: "post", encType: "application/json" }); }
  return <s-page heading="Skin Scan appearance" inlineSize="large">
    <UnsavedChangesBar id="appearance-save-bar" dirty={JSON.stringify(value) !== JSON.stringify(savedValue)} pending={fetcher.state !== "idle"} onSave={save} onDiscard={() => { setValue(savedValue); setIconError(""); }} />
    <s-button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>Save appearance</s-button>
    <s-button slot="secondary-actions" href="/app/settings">Global Settings</s-button>
    <s-link slot="breadcrumb-actions" href="/app/settings">Settings</s-link>
    <s-stack gap="base">
      {fetcher.state !== "idle" ? <s-stack gap="small-200"><s-text>Saving appearance</s-text><s-progress accessibilityLabel="Saving Skin Scan appearance" /></s-stack> : null}
      {fetcher.data?.ok ? <s-banner tone="success" heading="Appearance saved">Refresh your storefront to see the changes.</s-banner> : null}
      {fetcher.data?.error ? <s-banner tone="critical" heading="Could not save appearance">{fetcher.data.error}</s-banner> : null}
      <s-banner tone="info" heading="Enable the floating button on your storefront">Enable Skin Scan floating button in Theme editor / App embeds, then save the theme. It works on every page without adding a quiz block.<s-button href={embedUrl} target="_top">Enable in theme</s-button></s-banner>
      <s-section heading="Floating button"><s-icon slot="graphic" type="settings" />
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
      <s-section heading="Button icon">
        <s-stack gap="base">
          <s-paragraph>Upload PNG, JPG or WebP up to 5 MB; images are automatically resized for the button. SVG files can be up to 512 KB. You can also use an HTTPS image URL.</s-paragraph>
          <s-drop-zone id="scan-icon-upload" label={value.iconImage ? "Change button icon" : "Upload button icon"} accept=".svg,.png,.jpg,.jpeg,.webp" accessibilityLabel="Upload floating Skin Scan icon" error={iconError} onDropRejected={() => setIconError("Choose an SVG, PNG, JPG or WebP image.")} onChange={event => {
            const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
            setIconError("");
            const extension = file.name.split(".").pop()?.toLowerCase();
            const formats: Record<string,string> = {svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"};
            const mime = extension ? formats[extension] : undefined;
            const limit = mime === "image/svg+xml" ? 524288 : 5242880;
            if (file.size > limit || !mime) { setIconError(!mime ? "Choose an SVG, PNG, JPG or WebP image." : mime === "image/svg+xml" ? "SVG files must be under 512 KB. Use a smaller SVG or an HTTPS image URL." : "Choose an image under 5 MB or use an HTTPS image URL."); input.value=""; return; }
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result; if (typeof result !== "string") return;
              const source = `data:${mime};base64,${result.slice(result.indexOf(",")+1)}`;
              if (mime === "image/svg+xml") { setValue(current => ({...current,iconImage:source})); return; }
              const image = new Image();
              image.onload = () => {
                try {
                  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Invalid image");
                  const scale = Math.min(1,256/Math.max(image.naturalWidth,image.naturalHeight));
                  const canvas = document.createElement("canvas"); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
                  const context = canvas.getContext("2d"); if (!context) throw new Error("Image processing unavailable");
                  context.drawImage(image,0,0,canvas.width,canvas.height);
                  const iconImage = canvas.toDataURL("image/png");
                  if (iconImage.length > 700000) throw new Error("Image is too large after resizing");
                  setValue(current => ({...current,iconImage}));
                } catch { setIconError("Could not resize this image. Try another image or an HTTPS image URL."); }
              };
              image.onerror = () => setIconError("This file could not be opened as an image. Choose another file.");
              image.src=source;
            };
            reader.onerror = () => { setIconError("Could not read this file. Please try again."); input.value=""; };
            reader.readAsDataURL(file);
          }} />
          {value.iconImage ? <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <img src={value.iconImage} alt="Selected Skin Scan button icon" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",display:"block",background:value.buttonColor}} />
              <s-stack gap="small"><s-text type="strong">Selected button icon</s-text><s-text color="subdued">Save appearance to apply changes to your store.</s-text><s-stack direction="inline" gap="small"><s-button icon="edit" onClick={() => { const upload = document.getElementById("scan-icon-upload"); upload?.scrollIntoView({block:"center",behavior:"smooth"}); upload?.focus(); }}>Change image</s-button><s-button icon="delete" tone="critical" onClick={() => { setValue(current => ({...current,iconImage:""})); setIconError(""); }}>Remove image</s-button></s-stack></s-stack>
            </s-stack>
          </s-box> : null}
          <s-text-field label="Or HTTPS icon image URL" value={value.iconImage.startsWith("https://") ? value.iconImage : ""} onInput={event => { const iconImage = event.currentTarget.value; setValue(current => ({...current,iconImage})); }} />
          {!value.iconImage ? <s-stack direction="inline" gap="base" alignItems="center"><s-box inlineSize="72px"><s-image src={defaultScanIcon} alt="Default Skin Scan icon" aspectRatio="1 / 1" objectFit="contain" /></s-box><s-text color="subdued">Default Skin Scan illustration is active.</s-text></s-stack> : null}
          <s-stack direction="inline"><s-button disabled={!value.iconImage} onClick={() => setValue(current => ({...current,iconImage:""}))}>Reset to default icon</s-button></s-stack>
        </s-stack>
      </s-section>
      <s-section heading="Floating button colors">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {([["buttonColor", "Button background"], ["buttonTextColor", "Button text"]] as const).map(([key, label]) => <s-color-field key={key} label={label} required value={value[key]} onChange={event => { const color = event.currentTarget.value; setValue(current => ({...current,[key]:color})); }} />)}
        </div>
      </s-section>
      <s-section heading="Modal appearance">
        <s-stack gap="base">
          <s-paragraph>Customize the Skin Scan modal that opens from the floating button. Save appearance, then refresh your storefront to apply changes.</s-paragraph>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {([["panelColor", "Modal background"], ["textColor", "Modal text"], ["headingColor", "Modal headings"], ["accentColor", "Modal buttons and highlights"], ["modalButtonTextColor", "Modal button text"]] as const).map(([key, label]) => <s-color-field key={key} label={label} required value={value[key]} onChange={event => { const color = event.currentTarget.value; setValue(current => ({...current,[key]:color})); }} />)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:16}}>
            {([["modalFontSize", "Modal text size", 12, 18], ["modalWidth", "Modal width", 360, 760], ["modalRadius", "Modal rounded corners", 0, 40]] as const).map(([key, label, min, max]) => <s-number-field key={key} label={label} suffix="px" min={min} max={max} required value={String(value[key])} onChange={event => { const number = Number(event.currentTarget.value); setValue(current => ({...current,[key]:number})); }} />)}
          </div>
        </s-stack>
      </s-section>
      <s-section heading="Button preview">
        <div style={{ display: "flex", justifyContent: value.position === "left" ? "flex-start" : "flex-end", padding: 12, background: value.panelColor, borderRadius: 8 }}>
          <div role="img" style={{ background: value.buttonColor, color: value.buttonTextColor, borderRadius: value.shape === "circle" ? "50%" : value.radius, width: value.shape === "circle" ? 64 : undefined, height: value.shape === "circle" ? 64 : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, padding: value.shape === "circle" ? 0 : "18px 24px", font: "600 16px system-ui" }} aria-label={value.label || "Skin Scan"}>{value.iconImage ? <img src={value.iconImage} alt="" style={{width:value.shape === "circle" ? "100%" : 28,height:value.shape === "circle" ? "100%" : 28,objectFit:"cover",borderRadius:"50%",marginRight:value.shape === "circle" ? 0 : 8}} /> : null}{value.shape === "circle" ? value.iconImage ? null : <img src={defaultScanIcon} alt="" style={{width:52,height:52,objectFit:"contain",display:"block"}} /> : value.label || "Skin Scan"}</div>
        </div>
      </s-section>
      <s-stack direction="inline"><s-button variant="primary" loading={fetcher.state !== "idle"} onClick={save}>Save appearance</s-button></s-stack>
    </s-stack>
  </s-page>;
}
