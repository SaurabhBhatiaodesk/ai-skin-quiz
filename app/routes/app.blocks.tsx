import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData, useNavigation, useSearchParams, useSubmit } from "react-router";
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
      cover: quiz.coverImage || quiz.quick.find(question => question.image)?.image || quiz.deep.find(question => question.image)?.image || "/quiz-cover.svg",
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
    const paths = String(form.get("paths") || "").split(",").filter((path): path is "quick" | "deep" | "scan" => ["quick", "deep", "scan"].includes(path));
    if (!String(form.get("name") || "").trim() || !paths.length || (layout === "three" ? paths.length < 2 : paths.length !== 1)) throw new Response("Enter a name and choose quiz paths.", { status: 400 });
    await createQuiz(session.shop, String(form.get("name")), paths.length === 1 && paths[0] === "scan" ? "scan" : layout, paths);
    return redirect("/app/blocks");
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
  const [layout, setLayout] = useState<"three" | "single" | "scan" | null>(null);
  const [paths, setPaths] = useState<Array<"quick" | "deep" | "scan">>([]);
  const pending = navigation.state !== "idle";
  const [searchParams, setSearchParams] = useSearchParams();
  const creating = searchParams.get("create") === "1";

  return (
    <s-page heading={creating ? "Create quiz" : "All quizzes"} inlineSize="large">
      {creating ? <s-button slot="breadcrumb-actions" href="/app/blocks" accessibilityLabel="Back to all quizzes">Back</s-button> : null}
      <s-stack key={creating ? "create-quiz" : "quiz-list"} gap="base">
        {!creating ? <s-stack direction="inline"><s-button variant="primary" onClick={() => { setName(""); setLayout(null); setPaths([]); setSearchParams({ create: "1" }); }}>Create quiz</s-button></s-stack> : null}
        {creating ? <s-section heading="Create a quiz">
          <Form method="post" onSubmit={event => { event.preventDefault(); if (name.trim() && layout && paths.length) submit({ intent: "create", name: name.trim(), layout, paths: paths.join(",") }, { method: "post" }); }}>
            <s-stack key={creating ? "create-quiz" : "quiz-list"} gap="base">
              <s-text-field label="Quiz name" name="name" required value={name} onInput={event => setName(event.currentTarget.value)} />
              <s-text>What type of quiz would you like to create?</s-text>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                {([
                  { value: "three", title: "Combined Quiz", detail: "Choose two or three quiz paths in one widget." },
                  { value: "single", title: "Single Quiz", detail: "Choose one question flow or AI Skin Scan." },

                ] as const).map(option => <s-clickable key={option.value} accessibilityLabel={`Select ${option.title}`} border={layout === option.value ? "base strong" : "base"} background={layout === option.value ? "subdued" : "base"} borderRadius="base" padding="base" onClick={() => { setLayout(option.value); setPaths([]); }}>
                  <s-stack gap="small"><s-text type="strong">{option.title}</s-text><s-text color="subdued">{option.detail}</s-text>{layout === option.value ? <s-badge tone="info">Selected</s-badge> : null}</s-stack>
                </s-clickable>)}
              </s-grid>
              {layout ? <s-choice-list label="Which quiz paths do you want to include?" multiple={layout === "three"} values={paths} onChange={event => setPaths(event.currentTarget.values.filter((value): value is "quick" | "deep" | "scan" => ["quick", "deep", "scan"].includes(value)))}>
                <s-choice value="quick">Quick Quiz</s-choice><s-choice value="deep">Deep Dosha Diagnostic</s-choice><s-choice value="scan">AI Skin Scan</s-choice>
              </s-choice-list> : null}
              <s-stack direction="inline" gap="base"><s-button type="submit" variant="primary" loading={pending} disabled={!name.trim() || !layout || (layout === "three" ? paths.length < 2 : paths.length !== 1)}>Create quiz</s-button><s-button disabled={pending} onClick={() => setSearchParams({})}>Cancel</s-button></s-stack>
            </s-stack>
          </Form>
        </s-section> : null}
        {!creating && !quizzes.length ? <s-section heading="No quizzes yet"><s-paragraph>Create your first quiz to see it here and connect it to your theme.</s-paragraph></s-section> : null}
        {!creating ? <s-grid gridTemplateColumns="repeat(auto-fill, minmax(280px, 360px))" gap="large">
          {quizzes.map(quiz => <s-box key={quiz.handle} border="base" borderRadius="large" overflow="hidden" background="base">
            <s-clickable href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`} accessibilityLabel={`Open ${quiz.name}`}>
              <s-image src={quiz.cover} alt={`${quiz.name} cover`} aspectRatio="3 / 2" objectFit="cover" />
            </s-clickable>
            <s-box padding="large">
              <s-stack key={creating ? "create-quiz" : "quiz-list"} gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-link href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}><s-text type="strong">{quiz.name}</s-text></s-link>
                  <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel={`Actions for ${quiz.name}`} commandFor={`quiz-actions-${quiz.handle}`} command="--toggle" />
                  <s-popover id={`quiz-actions-${quiz.handle}`}><s-box padding="small"><s-stack gap="small">
                    <s-button href={quiz.addUrl} target="_top">Add to theme</s-button>
                    {quizzes.length ? <s-button tone="critical" disabled={pending} onClick={() => submit({ intent: "delete", handle: quiz.handle }, { method: "post" })}>Delete quiz</s-button> : null}
                  </s-stack></s-box></s-popover>
                </s-stack>
                <s-stack direction="inline" gap="small"><s-badge>{quiz.layout === "scan" ? "AI Skin Scan" : quiz.layout === "single" ? "Single Quiz" : "Combined Quiz"}</s-badge><s-badge>Saved</s-badge></s-stack>
                <s-text color="subdued">{quiz.layout === "scan" ? "Camera / photo upload" : `${quiz.questions} questions`}</s-text>
                <s-stack direction="inline"><s-button href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}>Edit quiz</s-button></s-stack>
              </s-stack>
            </s-box>

          </s-box>)}
        </s-grid> : null}
      </s-stack>
    </s-page>
  );
}
