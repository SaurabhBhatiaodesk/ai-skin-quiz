import { quizPreview } from "../quiz-preview";
import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { createQuiz } from "../quiz.server";
import { providerHasKey, selectedProvider } from "../settings.server";


type Path = "quick" | "deep" | "scan";

const TYPES = [
  { value: "three", icon: "theme", title: "Combined Quiz", detail: "Two or three quiz paths in one widget. Customers choose their path." },
  { value: "single", icon: "quiz", title: "Single Quiz", detail: "One question flow: Quick Skin Quiz or Dosha Quiz." },
  { value: "scan", icon: "scan", title: "Only Skin Scan", detail: "AI Skin Scan on its own, with consent, photo and results." },
  { value: "products", icon: "quiz", title: "Product Quiz", detail: "Questions and matched products only. No personalized reading." },
] as const;

const PATHS: Array<{ value: Path; title: string; detail: string }> = [
  { value: "quick", title: "Quick Skin Quiz", detail: "Short skin questions for product recommendations." },
  { value: "deep", title: "Dosha Quiz", detail: "Detailed Ayurvedic questions for a personal ritual." },
  { value: "scan", title: "AI Skin Scan", detail: "A selfie for skin observations and product matches." },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const provider = await selectedProvider(session.shop);
  return { scanConfigured: provider === "openai" && await providerHasKey(session.shop, "openai") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const layout = form.get("layout");
  if (!["three", "single", "scan", "products"].includes(String(layout))) return { error: "Choose a quiz type." };
  const paths = String(form.get("paths") || "").split(",").filter((path): path is Path => ["quick", "deep", "scan"].includes(path));
  if (!name || !paths.length || (layout === "three" ? paths.length < 2 : paths.length !== 1) || (layout === "scan" && paths[0] !== "scan") || ((layout === "single" || layout === "products") && paths[0] === "scan")) return { error: "Enter a quiz name and choose its quiz paths." };
  try {
  const quiz = await createQuiz(session.shop, name, paths.length === 1 && paths[0] === "scan" ? "scan" : layout === "three" ? "three" : "single", paths, layout === "products" ? "products" : "personalized");
  // Go straight to the new quiz so the merchant can add questions.
  return redirect(`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not create quiz." }; }
};

export default function NewQuiz() {
  const { scanConfigured } = useLoaderData<typeof loader>();
  const scanSetup = scanConfigured
    ? <s-paragraph color="subdued">Customers must consent to photo analysis before scanning.</s-paragraph>
    : <s-banner tone="info" heading="AI Skin Scan setup">Select OpenAI and add its API key in Global Settings. Customers must consent to photo analysis before scanning.</s-banner>;
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const pending = useNavigation().state !== "idle";
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<"three" | "single" | "scan" | "products" | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const valid = Boolean(name.trim() && layout && (layout === "three" ? paths.length >= 2 : paths.length === 1));
  const create = () => { if (valid && layout) submit({ name: name.trim(), layout, paths: paths.join(",") }, { method: "post" }); };

  return (
    <s-page heading="Create Quiz" inlineSize="base">
      <style>{`
        .quiz-types { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; font-family:Inter,sans-serif; }
        .quiz-type { position:relative; display:flex; flex-direction:column; padding:0; overflow:hidden; border:1px solid #e1e5e2; border-radius:16px; background:#fff; text-align:left; color:#111; cursor:pointer; font:inherit; }
        .quiz-type:focus-visible { outline:3px solid #b6d1bf; outline-offset:3px; }
        .quiz-type[aria-pressed=true] { border-color:#41664e; box-shadow:0 0 0 1px #41664e; }
        .quiz-type img { display:block; width:100%; aspect-ratio:4/3; object-fit:cover; background:#f4f6f2; }
        .product-preview { padding:14px; background:#eaf0eb; width:100%; aspect-ratio:12/7; box-sizing:border-box; }
        .product-preview-inner { background:white; border-radius:12px; padding:12px; height:100%; box-sizing:border-box; }
        .product-preview-title { font-size:14px; font-weight:600; margin-bottom:10px; color:#000; }
        .product-preview-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
        .product-preview-grid img { width:100%; height:70px; aspect-ratio:auto; object-fit:contain; background:#f6f3ed; border-radius:6px; }
        .product-preview-name { font-size:9px; line-height:12px; margin-top:5px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:#000; }
        .quiz-type-body { padding:20px; display:flex; flex-direction:column; gap:10px; flex:1; }
        .quiz-type-title { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:15px; font-weight:600; line-height:22px; }
        .quiz-type-check { display:grid; place-items:center; width:20px; height:20px; border:1px solid #d5ddd7; border-radius:50%; flex:none; }
        .quiz-type[aria-pressed=true] .quiz-type-check { color:white; border-color:#41664e; background:#41664e; }
        .quiz-type-description { color:#616961; font-size:13px; line-height:21px; margin:0; }
        @media(max-width:900px) { .quiz-types { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:460px) { .quiz-types { grid-template-columns:1fr; } }
      `}</style>
      <s-button slot="breadcrumb-actions" href="/app/quizzes" accessibilityLabel="Back to Quizzes and Skin Scan">Quizzes &amp; Skin Scan</s-button>
      <s-button slot="primary-action" variant="primary" loading={pending} disabled={!valid} onClick={create}>Create Quiz</s-button>
      <Form method="post" onSubmit={event => { event.preventDefault(); create(); }}>
        <s-stack gap="base">
          {actionData?.error ? <s-banner tone="critical" heading="Could not create quiz">{actionData.error}</s-banner> : null}
          <s-section heading="Quiz name">
            <s-text-field label="Quiz name" labelAccessibilityVisibility="exclusive" name="name" required placeholder="For example, Find your skin ritual" details="Give your quiz a name. Its numeric widget ID is generated automatically." value={name} onInput={event => setName(event.currentTarget.value)} />
          </s-section>
          <s-section heading="Quiz type">
            <div className="quiz-types" role="group" aria-label="Quiz type">
              {TYPES.map(option => <button type="button" className="quiz-type" key={option.value} aria-pressed={layout === option.value} onClick={() => { setLayout(option.value); setPaths(option.value === "scan" ? ["scan"] : option.value === "products" ? ["quick"] : []); }}>
                <img src={quizPreview(option.value)} alt={`${option.title} layout preview`} />
                <div className="quiz-type-body">
                  <div className="quiz-type-title"><span>{option.title}</span><span className="quiz-type-check" aria-hidden="true">{layout === option.value ? "✓" : ""}</span></div>
                  <p className="quiz-type-description">{option.detail}</p>
                </div>
              </button>)}
            </div>
          </s-section>
          {layout && layout !== "scan" && layout !== "products" ? <s-section heading={layout === "three" ? "Choose quiz options" : "Choose your quiz"}>
            <s-stack gap="base">
              <s-paragraph>{layout === "three" ? "Select two or three options." : "Select one option."}</s-paragraph>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap="base">
                {PATHS.filter(path => layout === "three" || path.value !== "scan").map(path => {
                  const selected = paths.includes(path.value);
                  return <s-clickable key={path.value} accessibilityLabel={`${path.title}, ${selected ? "selected" : "not selected"}. ${layout === "three" ? "Toggle selection" : "Select this experience"}`} border={selected ? "base strong" : "base"} background={selected ? "subdued" : "base"} borderRadius="large" padding="base" onClick={() => setPaths(current => layout === "single" ? [path.value] : current.includes(path.value) ? current.filter(value => value !== path.value) : [...current, path.value])}>
                    <s-stack gap="base">
                      <s-box maxInlineSize="80px">
                        <s-image src={`/images/onboarding/${path.value === "quick" ? "quiz" : path.value === "deep" ? "dosha" : "scan"}.svg`} alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" />
                      </s-box>
                      <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                        <s-text type="strong">{path.title}</s-text>
                        <s-icon type={selected ? "check-circle" : "circle"} />
                      </s-stack>
                      <s-text color="subdued">{path.detail}</s-text>
                    </s-stack>
                  </s-clickable>;
                })}
              </s-grid>
              {paths.includes("scan") ? scanSetup : null}
            </s-stack>
          </s-section> : null}
          {layout === "scan" ? scanSetup : null}
          <s-stack direction="inline" justifyContent="end" gap="small">
            <s-button href="/app/quizzes" disabled={pending}>Cancel</s-button>
            <s-button type="submit" variant="primary" loading={pending} disabled={!valid}>Create Quiz</s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
