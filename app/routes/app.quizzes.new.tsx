import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { createQuiz } from "../quiz.server";

type Path = "quick" | "deep" | "scan";

const TYPES = [
  { value: "three", title: "Combined Quiz", detail: "Two or three quiz paths in one widget. Customers choose their path." },
  { value: "single", title: "Single Quiz", detail: "One question flow, or AI Skin Scan on its own." },
] as const;

const PATHS: Array<{ value: Path; title: string; detail: string }> = [
  { value: "quick", title: "Quick Skin Quiz", detail: "Short skin questions for product recommendations." },
  { value: "deep", title: "Dosha Quiz", detail: "Detailed Ayurvedic questions for a personal ritual." },
  { value: "scan", title: "AI Skin Scan", detail: "A selfie for skin observations and product matches." },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const layout = form.get("layout") === "single" ? "single" : "three";
  const paths = String(form.get("paths") || "").split(",").filter((path): path is Path => ["quick", "deep", "scan"].includes(path));
  if (!name || !paths.length || (layout === "three" ? paths.length < 2 : paths.length !== 1)) return { error: "Enter a quiz name and choose its quiz paths." };
  try {
  const quiz = await createQuiz(session.shop, name, paths.length === 1 && paths[0] === "scan" ? "scan" : layout, paths);
  // Go straight to the new quiz so the merchant can add questions.
  return redirect(`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not create quiz." }; }
};

export default function NewQuiz() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const pending = useNavigation().state !== "idle";
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<"three" | "single" | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const valid = Boolean(name.trim() && layout && (layout === "three" ? paths.length >= 2 : paths.length === 1));
  const create = () => { if (valid && layout) submit({ name: name.trim(), layout, paths: paths.join(",") }, { method: "post" }); };

  return (
    <s-page heading="Create quiz" inlineSize="base">
      <s-button slot="breadcrumb-actions" href="/app/quizzes" accessibilityLabel="Back to quizzes">Quizzes</s-button>
      <s-button slot="primary-action" variant="primary" loading={pending} disabled={!valid} onClick={create}>Create quiz</s-button>
      <Form method="post" onSubmit={event => { event.preventDefault(); create(); }}>
        <s-stack gap="base">
          {actionData?.error ? <s-banner tone="critical" heading="Could not create quiz">{actionData.error}</s-banner> : null}
          <s-section heading="Quiz name">
            <s-text-field label="Quiz name" labelAccessibilityVisibility="exclusive" name="name" required placeholder="For example, Find your skin ritual" details="Only you see this name. It also becomes the widget ID." value={name} onInput={event => setName(event.currentTarget.value)} />
          </s-section>
          <s-section heading="Quiz type">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              {TYPES.map(option => <s-clickable key={option.value} accessibilityLabel={`Select ${option.title}`} border={layout === option.value ? "base strong" : "base"} background={layout === option.value ? "subdued" : "base"} borderRadius="base" padding="base" onClick={() => { setLayout(option.value); setPaths([]); }}>
                <s-stack gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center"><s-text type="strong">{option.title}</s-text>{layout === option.value ? <s-icon type="check-circle" /> : null}</s-stack>
                  <s-text color="subdued">{option.detail}</s-text>
                </s-stack>
              </s-clickable>)}
            </s-grid>
          </s-section>
          {layout ? <s-section heading={layout === "three" ? "Choose quiz options" : "Choose your quiz"}>
            <s-stack gap="base">
              <s-paragraph>{layout === "three" ? "Select two or three options." : "Select one option."}</s-paragraph>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap="base">
                {PATHS.map(path => {
                  const selected = paths.includes(path.value);
                  return <s-clickable key={path.value} accessibilityLabel={`${path.title}, ${selected ? "selected" : "not selected"}. ${layout === "three" ? "Toggle selection" : "Select this experience"}`} border={selected ? "base strong" : "base"} background={selected ? "subdued" : "base"} borderRadius="large" padding="base" onClick={() => setPaths(current => layout === "single" ? [path.value] : current.includes(path.value) ? current.filter(value => value !== path.value) : [...current, path.value])}>
                    <s-stack gap="base">
                      <s-box maxInlineSize="64px">
                        <s-image src={`/images/quiz-options/${path.value}.svg`} alt="" aspectRatio="1 / 1" objectFit="contain" />
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
            </s-stack>
            {paths.includes("scan") ? <s-banner tone="info" heading="AI Skin Scan setup">Add your OpenAI API key in Global Settings. Customers must consent to photo analysis before scanning.</s-banner> : null}
          </s-section> : null}
          <s-stack direction="inline" justifyContent="end" gap="small">
            <s-button href="/app/quizzes" disabled={pending}>Cancel</s-button>
            <s-button type="submit" variant="primary" loading={pending} disabled={!valid}>Create quiz</s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
