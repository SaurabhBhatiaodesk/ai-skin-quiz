import { widgetEmbedCode } from "../widget-embed";
import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteQuiz } from "../quiz.server";
import { quizOverview } from "../overview.server";
import { LAYOUT_NAMES } from "../quiz-shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  return quizOverview(session.shop, admin);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") await deleteQuiz(session.shop, String(form.get("handle") || ""));
  return { ok: true };
};

export default function Quizzes() {
  const { quizzes, themeActivated, themeEditorUrl } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const pending = useNavigation().state !== "idle";
  const [developerQuiz, setDeveloperQuiz] = useState<{ handle: string; name: string; layout: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyTarget, setCopyTarget] = useState("");
  const apiPath = developerQuiz ? `/apps/dosha-quiz/quiz?code=${encodeURIComponent(developerQuiz.handle)}` : "";
  const embedCode = developerQuiz ? widgetEmbedCode(developerQuiz.handle) : "";
  const fetchExample = `const response = await fetch(${JSON.stringify(apiPath)}, {
  headers: { Accept: "application/json" }
});
const quiz = await response.json();
if (!response.ok) throw new Error(quiz.error || "Could not load quiz");
// Use quiz.layout, quiz.enabledPaths, quiz.quick and quiz.deep
// to build your own question flow and markup.
// Use quiz.design for the merchant's saved style choices.
// quiz.defaultCss and quiz.widgetCss are optional stylesheet starting points.`;
  const resultExample = `const response = await fetch("/apps/dosha-quiz/result", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    code: quiz.handle,
    path: "quick", // or "deep"
    answers: selectedOptionIndexes // one valid option index per question
  })
});
const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(payload.error || "Could not submit quiz.");
}
// Render payload.result and payload.result.products in your design.`;
  const scanExample = `if (!quiz.enabledPaths.includes("scan") || !quiz.scanReady) {
  throw new Error("Skin Scan is not enabled and ready for this quiz.");
}
if (!ageConfirmed || !photoConsentGiven) {
  throw new Error("Confirm age and photo-analysis consent first.");
}
const response = await fetch("/apps/dosha-quiz/result", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    code: quiz.handle,
    path: "scan",
    images: [photoDataUrl], // JPG, PNG or WebP data URL; max 5 MB combined
    adult: ageConfirmed,
    consent: photoConsentGiven
  })
});
const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(payload.error || "Could not analyze this photo.");
}
// Render payload.result observations and matched products.
// This is cosmetic observation, not medical diagnosis.`;
  async function copyDeveloperValue(value: string, label: string) {
    setCopyTarget(label);
    setCopyStatus("");
    try { await navigator.clipboard.writeText(value); setCopyStatus(`${label} copied.`); }
    catch { setCopyStatus("Copy is blocked by this browser. Select the text below and copy it manually."); }
  }
  const [deleting, setDeleting] = useState<{ handle: string; name: string; layout: string } | null>(null);

  return (
    <s-page heading="Quizzes &amp; Skin Scan" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create Quiz</s-button>
      {themeActivated ? <s-button slot="secondary-actions" href={themeEditorUrl} target="_top">Open theme editor</s-button> : null}
      {!quizzes.length ? <s-section>
        <s-stack alignItems="center"><s-box inlineSize="120px"><s-image src="/images/onboarding/quiz.svg" alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" /></s-box></s-stack>
        <s-empty-state heading="Create your first quiz">
          <s-text slot="subheading">Choose a question quiz or Skin Scan, then connect it to your store.</s-text>
          <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create Quiz</s-button>
        </s-empty-state>
      </s-section> : <s-grid gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap="large">
        {quizzes.map(quiz => <s-box key={quiz.handle} border="base" borderRadius="large" overflow="hidden" background="base">
          <s-clickable href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`} accessibilityLabel={`Open ${quiz.name}`}>
            <img src={quiz.cover} alt={`${quiz.name} cover`} loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#f4f6f2" }} onError={event => { if (event.currentTarget.dataset.fallback) return; event.currentTarget.dataset.fallback = "1"; event.currentTarget.src = quiz.defaultCover; }} />
          </s-clickable>
          <s-box padding="base">
            <s-stack gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <div style={{ minHeight: 44, flex: 1, minWidth: 0 }}><s-link href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}><span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 15, lineHeight: "24px", fontWeight: 600, color: "#000000" }}>{quiz.name}</span></s-link></div>
                <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel={`Actions for ${quiz.name}`} commandFor={`quiz-actions-${quiz.handle}`} command="--toggle" />
                <s-popover id={`quiz-actions-${quiz.handle}`}><s-box padding="small"><s-stack gap="small">
                  <s-button icon="store" variant="tertiary" href={quiz.addUrl} target="_top">Add to theme</s-button>
                  <s-button icon="delete" variant="tertiary" tone="critical" disabled={pending} commandFor="delete-quiz-modal" command="--show" onClick={() => setDeleting({ handle: quiz.handle, name: quiz.name, layout: quiz.layout })}>{quiz.layout === "scan" ? "Delete Skin Scan" : "Delete quiz"}</s-button>
                </s-stack></s-box></s-popover>
              </s-stack>
              <s-stack direction="inline" gap="small">
                <s-badge>{LAYOUT_NAMES[quiz.layout]}</s-badge>
                {quiz.layout !== "scan" && !quiz.questions ? <s-badge tone="warning" icon="alert-triangle">No questions</s-badge> : null}
                {quiz.live ? <s-badge tone="success" icon="view">Live in theme</s-badge> : null}
                {quiz.scanPending ? <s-badge tone="warning" icon="alert-triangle">Skin Scan not connected</s-badge> : null}
              </s-stack>
              <s-text color="subdued">{quiz.layout === "scan" ? "Camera or photo upload" : `${quiz.questions} ${quiz.questions === 1 ? "question" : "questions"}`}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button icon="edit" href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}>{quiz.layout === "scan" ? "Edit Skin Scan" : "Edit quiz"}</s-button>
                <s-button icon="code" commandFor="quiz-developer-modal" command="--show" onClick={() => { setDeveloperQuiz({handle:quiz.handle,name:quiz.name,layout:quiz.layout}); setCopyStatus(""); setCopyTarget(""); }}>Embed &amp; API</s-button>
              </s-stack>
            </s-stack>
          </s-box>
        </s-box>)}
      </s-grid>}
      <s-modal id="quiz-developer-modal" heading={developerQuiz ? `${developerQuiz.name}: ${developerQuiz.layout === "scan" ? "Skin Scan actions" : "Quiz actions"}` : "Quiz actions"}>
        <s-stack gap="base">
          <s-stack gap="small">
            <s-heading>Embed code</s-heading>
            <s-paragraph>Paste this code into a Custom Liquid section in your Shopify theme, then save. It loads this widget and adjusts its height automatically. If you already pasted an older embed, replace the entire old code with this version—saved theme code does not update itself.</s-paragraph>
            <s-text-area label="Shopify Custom Liquid embed code" readOnly rows={5} value={embedCode} />
            <s-stack direction="inline" gap="small" alignItems="center"><s-button icon={copyStatus === "Embed code copied." ? "check" : "clipboard"} onClick={() => copyDeveloperValue(embedCode, "Embed code")}>{copyStatus === "Embed code copied." ? "Copied" : "Copy code"}</s-button>{copyTarget === "Embed code" && copyStatus ? <span role="status" style={{fontSize:12,color:copyStatus.endsWith("copied.") ? "#27633D" : "#A12D2D"}}>{copyStatus}</span> : null}</s-stack>
          </s-stack>
          <s-heading>Build your own quiz design</s-heading>
          <s-paragraph>This API belongs to the selected block only. Build your own HTML, styling and mobile layout using its questions and answers, then submit responses to get its matched results and products. Combined Quiz, Single Quiz, Product Quiz and Skin Scan each use their own widget ID.</s-paragraph>
          <s-text-field label="Selected widget ID" readOnly value={developerQuiz?.handle || ""} />
          <s-paragraph>Use the storefront API from your store&apos;s domain—no API key in browser code. Your custom HTML/CSS can use the saved quiz settings and design values returned by the API.</s-paragraph>
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text type="strong">1. Load this quiz</s-text>
            <s-button variant="secondary" onClick={() => copyDeveloperValue(apiPath,"API URL")}>{copyStatus === "API URL copied." ? "Copied" : "Copy API URL"}</s-button>
          </s-stack>
          <s-text-field label="Quiz data API" readOnly value={apiPath} />
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text type="strong">Fetch quiz data</s-text>
            <s-button variant="secondary" onClick={() => copyDeveloperValue(fetchExample, "Example")}>{copyStatus === "Example copied." ? "Copied" : "Copy example"}</s-button>
          </s-stack>
          <s-text-area label="JavaScript: load saved quiz" readOnly rows={7} value={fetchExample} />
          <s-paragraph>Every quiz has its own ID. The response includes questions, available paths, product mappings and saved design values. The data endpoint is read-only; merchants change saved settings in the app, then your custom storefront reads the latest saved values.</s-paragraph>
          {developerQuiz?.layout !== "scan" ? <>
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">2. Submit quiz answers</s-text>
              <s-button variant="secondary" onClick={() => copyDeveloperValue(resultExample, "Result example")}>{copyStatus === "Result example copied." ? "Copied" : "Copy example"}</s-button>
            </s-stack>
            <s-text-area label="JavaScript: submit answers" readOnly rows={9} value={resultExample} />
          </> : null}
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text type="strong">{developerQuiz?.layout === "scan" ? "2. Submit a consented Skin Scan" : "3. Optional: submit a Skin Scan"}</s-text>
            <s-button variant="secondary" onClick={() => copyDeveloperValue(scanExample, "Skin Scan example")}>{copyStatus === "Skin Scan example copied." ? "Copied" : "Copy example"}</s-button>
          </s-stack>
          <s-text-area label="JavaScript: submit a photo for cosmetic observations" readOnly rows={13} value={scanExample} />
          <s-paragraph>Before sending a photo, show and obtain explicit consent and age confirmation. Photos must be JPG, PNG or WebP data URLs, up to five and 5 MB combined. The result endpoint returns cosmetic observations and matched products—not a medical diagnosis. Deep report details stay email-gated. Call through the Shopify storefront app proxy; never put provider keys or credentials in browser code.</s-paragraph>
          <s-link href="/app/documentation">API request and response guide</s-link>
          <div role="status" aria-live="polite">{copyTarget !== "Embed code" ? copyStatus : ""}</div>
        </s-stack>
        <s-button slot="secondary-actions" commandFor="quiz-developer-modal" command="--hide">Close</s-button>
      </s-modal>
      <s-modal id="delete-quiz-modal" heading={deleting?.layout === "scan" ? "Delete Skin Scan?" : "Delete quiz?"}>
        <s-paragraph>{deleting ? `"${deleting.name}" will be deleted with its ${deleting.layout === "scan" ? "results and product mappings" : "questions, results and product mappings"}. Theme blocks using it will stop showing this ${deleting.layout === "scan" ? "scan widget" : "quiz"}. This cannot be undone.` : ""}</s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-quiz-modal" command="--hide" onClick={() => { if (deleting) submit({ intent: "delete", handle: deleting.handle }, { method: "post" }); setDeleting(null); }}>{deleting?.layout === "scan" ? "Delete Skin Scan" : "Delete quiz"}</s-button>
        <s-button slot="secondary-actions" commandFor="delete-quiz-modal" command="--hide" onClick={() => setDeleting(null)}>Cancel</s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
