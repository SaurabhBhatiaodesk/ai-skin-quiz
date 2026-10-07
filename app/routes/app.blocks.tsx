import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { createQuiz, deleteQuiz, loadLibrary } from "../quiz.server";

const API_KEY = "7c7f0cc16b5b8d2c0ea9bd2158176233";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quizzes = await loadLibrary(session.shop);
  const store = session.shop.replace(".myshopify.com", "");
  const apiKey = process.env.SHOPIFY_API_KEY || API_KEY;
  return {
    quizzes: quizzes.map((quiz) => ({
      handle: quiz.handle,
      name: quiz.name,
      layout: quiz.layout || "three",
      questions: quiz.quick.length + quiz.deep.length,
      addUrl: `https://admin.shopify.com/store/${store}/themes/current/editor?template=index&addAppBlockId=${apiKey}/${quiz.layout === "single" ? "single-quiz" : quiz.layout === "scan" ? "skin-scan" : "dosha-quiz"}&target=newAppsSection`,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "create") {
    const layout = form.get("layout") === "scan" ? "scan" : form.get("layout") === "single" ? "single" : "three";
    const quiz = await createQuiz(session.shop, String(form.get("name") || "New quiz"), layout);
    return redirect(`/app?quiz=${quiz.handle}`);
  }
  if (intent === "delete") {
    await deleteQuiz(session.shop, String(form.get("handle") || ""));
  }
  return { ok: true };
};

export default function Blocks() {
  const { quizzes } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<"three" | "single" | "scan">("three");
  const pending = navigation.state !== "idle";

  return (
    <s-page heading="Quiz blocks" inlineSize="large">
      <s-stack gap="base">
        <s-paragraph color="subdued">Add block opens the theme editor with this quiz on the homepage. Press Save in the theme editor.</s-paragraph>
        <s-section heading="Create a quiz">
          <Form method="post" onSubmit={event => { event.preventDefault(); if (name.trim()) submit({ intent: "create", name: name.trim(), layout }, { method: "post" }); }}>
            <s-stack gap="base">
              <s-text-field label="Quiz name" name="name" required value={name} onInput={event => setName(event.currentTarget.value)} />
              <s-text>What type of quiz would you like to create?</s-text>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                {([
                  { value: "three", title: "Combined Quiz (3 paths)", detail: "Quick Quiz, Deep Quiz and AI Skin Scan." },
                  { value: "single", title: "Single Quiz", detail: "One question flow with up to 40 questions." },
                  { value: "scan", title: "AI Skin Scan", detail: "Camera or photo upload only. Requires a connected analysis provider." },
                ] as const).map(option => <s-clickable key={option.value} accessibilityLabel={`Select ${option.title}`} border={layout === option.value ? "base strong" : "base"} background={layout === option.value ? "subdued" : "base"} borderRadius="base" padding="base" onClick={() => setLayout(option.value)}>
                  <s-stack gap="small"><s-text type="strong">{option.title}</s-text><s-text color="subdued">{option.detail}</s-text>{layout === option.value ? <s-badge tone="info">Selected</s-badge> : null}</s-stack>
                </s-clickable>)}
              </s-grid>
              <s-stack direction="inline"><s-button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>New quiz</s-button></s-stack>
            </s-stack>
          </Form>
        </s-section>
        {quizzes.map(quiz => <s-section key={quiz.handle} heading={quiz.name}>
          <s-stack gap="base">
            <s-stack direction="inline" gap="small"><s-badge>{quiz.layout === "scan" ? "AI Skin Scan" : quiz.layout === "single" ? "Single Quiz" : "Combined Quiz (3 paths)"}</s-badge>{quiz.layout !== "scan" ? <s-text color="subdued">{quiz.questions} questions</s-text> : <s-text color="subdued">Camera / photo upload</s-text>}</s-stack>
            <s-text-field label="Shopify widget code" readOnly value={quiz.handle} />
            <s-stack direction="inline" gap="small">
              <s-button variant="primary" href={quiz.addUrl} target="_top">Add block</s-button>
              <s-button href={`/app?quiz=${quiz.handle}`}>Edit quiz</s-button>
              {quizzes.length > 1 ? <s-button tone="critical" disabled={pending} onClick={() => submit({ intent: "delete", handle: quiz.handle }, { method: "post" })}>Delete</s-button> : null}
            </s-stack>
            <s-paragraph color="subdued">{quiz.handle === "dosha-quiz" ? "This block already uses the widget code dosha-quiz. You do not need to paste anything." : `After the block is added, paste ${quiz.handle} into the block setting Shopify widget code.`}</s-paragraph>
          </s-stack>
        </s-section>)}
      </s-stack>
    </s-page>
  );
}
