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
  const [developerQuiz, setDeveloperQuiz] = useState<{ handle: string; name: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const apiPath = developerQuiz ? `/apps/dosha-quiz/quiz?code=${encodeURIComponent(developerQuiz.handle)}` : "";
  async function copyDeveloperValue(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyStatus(`${label} copied.`); }
    catch { setCopyStatus("Copy is blocked by this browser. Select the text below and copy it manually."); }
  }
  const [deleting, setDeleting] = useState<{ handle: string; name: string } | null>(null);

  return (
    <s-page heading="Quizzes" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create quiz</s-button>
      {themeActivated ? <s-button slot="secondary-actions" href={themeEditorUrl} target="_top">Open theme editor</s-button> : null}
      {!quizzes.length ? <s-section heading="Create your first quiz">
        <s-stack gap="base">
          <s-paragraph>Build a Combined Quiz, Single Quiz or AI Skin Scan, then add it to your theme.</s-paragraph>
          <s-stack direction="inline"><s-button variant="primary" href="/app/quizzes/new">Create quiz</s-button></s-stack>
        </s-stack>
      </s-section> : <s-grid gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap="large">
        {quizzes.map(quiz => <s-box key={quiz.handle} border="base" borderRadius="large" overflow="hidden" background="base">
          <s-clickable href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`} accessibilityLabel={`Open ${quiz.name}`}>
            <s-image src={quiz.cover} alt={`${quiz.name} cover`} aspectRatio="3 / 2" objectFit="cover" />
          </s-clickable>
          <s-box padding="base">
            <s-stack gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-link href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}><s-text type="strong">{quiz.name}</s-text></s-link>
                <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel={`Actions for ${quiz.name}`} commandFor={`quiz-actions-${quiz.handle}`} command="--toggle" />
                <s-popover id={`quiz-actions-${quiz.handle}`}><s-box padding="small"><s-stack gap="small">
                  <s-button variant="tertiary" href={quiz.addUrl} target="_top">Add to theme</s-button>
                  <s-button variant="tertiary" tone="critical" disabled={pending} commandFor="delete-quiz-modal" command="--show" onClick={() => setDeleting({ handle: quiz.handle, name: quiz.name })}>Delete quiz</s-button>
                </s-stack></s-box></s-popover>
              </s-stack>
              <s-stack direction="inline" gap="small">
                <s-badge>{LAYOUT_NAMES[quiz.layout]}</s-badge>
                {quiz.layout !== "scan" && !quiz.questions ? <s-badge tone="warning">No questions</s-badge> : null}
                {quiz.live ? <s-badge tone="success">Live in theme</s-badge> : null}
                {quiz.scanPending ? <s-badge tone="warning">Skin Scan not connected</s-badge> : null}
              </s-stack>
              <s-text color="subdued">{quiz.layout === "scan" ? "Camera or photo upload" : `${quiz.questions} ${quiz.questions === 1 ? "question" : "questions"}`}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}>Edit quiz</s-button>
                <s-button commandFor="quiz-developer-modal" command="--show" onClick={() => { setDeveloperQuiz({handle:quiz.handle,name:quiz.name}); setCopyStatus(""); }}>Quiz API</s-button>
                {!themeActivated ? <s-button variant="tertiary" href={quiz.addUrl} target="_top">Activate in theme</s-button> : null}
              </s-stack>
            </s-stack>
          </s-box>
        </s-box>)}
      </s-grid>}
      <s-modal id="quiz-developer-modal" heading={developerQuiz ? `${developerQuiz.name}: Quiz API` : "Quiz API"}>
        <s-stack gap="base">
          <s-paragraph>Fetch this URL from your Shopify storefront to get this quiz?s data.</s-paragraph>
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text type="strong">Quiz data API</s-text>
            <s-button variant="tertiary" onClick={() => copyDeveloperValue(apiPath,"API URL")}>Copy API URL</s-button>
          </s-stack>
          <textarea aria-label="Quiz data API" readOnly value={apiPath} rows={2} style={{width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #ccc",borderRadius:8,fontFamily:"monospace",resize:"none"}} onFocus={event => event.currentTarget.select()} />
          <div role="status" aria-live="polite">{copyStatus}</div>
        </s-stack>
        <s-button slot="secondary-actions" commandFor="quiz-developer-modal" command="--hide">Close</s-button>
      </s-modal>
      <s-modal id="delete-quiz-modal" heading="Delete quiz?">
        <s-paragraph>{deleting ? `"${deleting.name}" will be deleted with its questions, results and product mappings. Theme blocks using it will stop showing the quiz. This cannot be undone.` : ""}</s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-quiz-modal" command="--hide" onClick={() => { if (deleting) submit({ intent: "delete", handle: deleting.handle }, { method: "post" }); setDeleting(null); }}>Delete quiz</s-button>
        <s-button slot="secondary-actions" commandFor="delete-quiz-modal" command="--hide" onClick={() => setDeleting(null)}>Cancel</s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
