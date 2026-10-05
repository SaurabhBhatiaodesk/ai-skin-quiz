import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
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
      addUrl: `https://admin.shopify.com/store/${store}/themes/current/editor?template=index&addAppBlockId=${apiKey}/dosha-quiz&target=newAppsSection`,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "create") {
    const layout = form.get("layout") === "single" ? "single" : "three";
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

  return (
    <div className="blocks">
      <style>{`
        .blocks { padding: 20px; color: #202223; font: 14px/1.45 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .blocks h1 { margin: 0 0 6px; font-size: 22px; }
        .blocks > p { margin: 0 0 16px; color: #6d7175; max-width: 640px; }
        .blocks-new, .block-card { background: #fff; border-radius: 16px; box-shadow: 0 0 0 1px #e6e6e6; padding: 16px; }
        .blocks-new { display: grid; gap: 14px; margin-bottom: 14px; max-width: 720px; }
        .quiz-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; border: 0; margin: 0; padding: 0; }
        .quiz-types legend { font-weight: 600; margin-bottom: 10px; }
        .quiz-type { display: flex; align-items: flex-start; gap: 10px; border: 1px solid #c9cccf; border-radius: 10px; padding: 14px; cursor: pointer; }
        .quiz-type:has(input:checked) { border-color: #202223; background: #f6f6f7; box-shadow: inset 0 0 0 1px #202223; }
        .blocks-new .quiz-type input { width: auto; margin-top: 4px; accent-color: #202223; }
        .quiz-type strong, .quiz-type small { display: block; }
        .quiz-type small { color: #6d7175; margin-top: 4px; }
        .blocks-new button { justify-self: start; }
        .blocks-new input, .block-field input { width: 100%; border: 1px solid #c9cccf; border-radius: 8px; padding: 8px 10px; font: inherit; background: #fff; color: #202223; }
        .blocks button, .block-add { border: 0; background: #2c2c2c; color: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .block-list { display: grid; gap: 12px; max-width: 720px; }
        .block-card { display: grid; gap: 12px; }
        .block-card h2 { margin: 0; font-size: 18px; }
        .block-card small { color: #6d7175; }
        .block-field { display: grid; gap: 6px; color: #6d7175; font-size: 13px; }
        .block-actions { display: flex; gap: 8px; align-items: center; }
        .block-edit, .block-delete { background: #fff; color: #202223; border: 1px solid #c9cccf; border-radius: 8px; padding: 8px 14px; text-decoration: none; font: inherit; cursor: pointer; }
        .block-delete { color: #d72c0d; border: 0; }
      `}</style>
      <h1>Quiz blocks</h1>
      <p>Add block opens the theme editor with this quiz on the homepage. Press Save in the theme editor.</p>
      <Form method="post" className="blocks-new">
        <input name="name" placeholder="Quiz name" aria-label="Quiz name" required />
        <fieldset className="quiz-types">
          <legend>What type of quiz would you like to create?</legend>
          <label className="quiz-type" htmlFor="quiz-layout-three" aria-label="3-block quiz">
            <input id="quiz-layout-three" type="radio" name="layout" value="three" defaultChecked />
            <span><strong>3-block quiz</strong><small>Quick Quiz, Deep Quiz and AI Skin Scan — the existing experience.</small></span>
          </label>
          <label className="quiz-type" htmlFor="quiz-layout-single" aria-label="Single-block quiz">
            <input id="quiz-layout-single" type="radio" name="layout" value="single" />
            <span><strong>Single-block quiz</strong><small>One question flow with up to 40 questions.</small></span>
          </label>
        </fieldset>
        <input type="hidden" name="intent" value="create" />
        <button type="submit">New quiz</button>
      </Form>
      <div className="block-list">
        {quizzes.map((quiz) => (
          <article className="block-card" key={quiz.handle}>
            <div>
              <h2>{quiz.name}</h2>
              <small>{quiz.layout === "single" ? "Single-block quiz" : "3-block quiz"} · {quiz.questions} questions</small>
            </div>
            <label className="block-field">
              Quiz code
              <input readOnly value={quiz.handle} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div className="block-actions">
              <a className="block-add" href={quiz.addUrl} target="_top">Add block</a>
              <a className="block-edit" href={`/app?quiz=${quiz.handle}`}>Edit quiz</a>
              {quizzes.length > 1 ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="handle" value={quiz.handle} />
                  <button className="block-delete" type="submit">Delete</button>
                </Form>
              ) : null}
            </div>
            {quiz.handle === "dosha-quiz" ? (
              <small>This block already uses the code dosha-quiz. You do not need to paste anything.</small>
            ) : (
              <small>After the block is added, paste {quiz.handle} into the block setting Quiz code.</small>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
