import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { quizOverview } from "../overview.server";
import { LAYOUT_NAMES } from "../quiz-shared";
import { reportStats } from "../report.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const [overview, stats] = await Promise.all([quizOverview(session.shop, admin), reportStats(session.shop)]);
  return { ...overview, stats };
};

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <s-box border="base" borderRadius="base" padding="base" background="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        <s-text color="subdued">{detail}</s-text>
      </s-stack>
    </s-box>
  );
}

export default function Home() {
  const { quizzes, themeChecked, themeActivated, themeEditorUrl, stats } = useLoaderData<typeof loader>();
  const liveCount = quizzes.filter((quiz) => quiz.live).length;

  return (
    <s-page heading="Home" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create quiz</s-button>
      <s-button slot="secondary-actions" href="/app/documentation">Documentation</s-button>
      <s-stack gap="large">
        <div style={{ background: "linear-gradient(120deg, #e8f3e9 0%, #fff1db 55%, #f3e6f5 100%)", border: "1px solid #dfdfd5", borderRadius: "16px", padding: "clamp(24px, 4vw, 40px)" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.2, fontWeight: 700, color: "#356347" }}>Welcome to <span style={{ color: "#946027" }}>AI Skin Quiz</span></h2>
          <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.6, color: "#4b5350" }}>Recommend the right products with an Ayurvedic skin quiz on your storefront.</p>
        </div>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
          <Stat label="Quizzes" value={String(quizzes.length)} detail={quizzes.length === 1 ? "1 quiz created" : `${quizzes.length} quizzes created`} />
          <Stat label="Storefront" value={themeActivated ? "Active" : "Not active"} detail={themeChecked ? `${liveCount} live in your theme` : themeActivated ? "Quiz block added to your theme" : "Add the quiz block to your theme"} />
          <Stat label="Results" value={String(stats.results)} detail="Quizzes completed in the last 7 days" />
          <Stat label="Emails" value={String(stats.emails)} detail="Customers who saved their result in the last 7 days" />
        </s-grid>

        <s-section heading="Your quizzes">
          {quizzes.length ? <s-stack gap="base">
            {quizzes.slice(0, 3).map((quiz) => <s-box key={quiz.handle} border="base" borderRadius="base" padding="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
                <s-stack gap="small-200">
                  <s-link href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}><s-text type="strong">{quiz.name}</s-text></s-link>
                  <s-stack direction="inline" gap="small">
                    <s-badge>{LAYOUT_NAMES[quiz.layout]}</s-badge>
                    {quiz.layout !== "scan" && !quiz.questions ? <s-badge tone="warning">No questions</s-badge> : null}
                    {quiz.live ? <s-badge tone="success">Live in theme</s-badge> : null}
                    {quiz.scanPending ? <s-badge tone="warning">Skin Scan not connected</s-badge> : null}
                  </s-stack>
                </s-stack>
                <s-button href={`/app/editor?quiz=${encodeURIComponent(quiz.handle)}`}>Edit</s-button>
              </s-stack>
            </s-box>)}
            <s-stack direction="inline" gap="small">
              <s-button href="/app/quizzes">View all quizzes</s-button>
              {themeActivated ? <s-button variant="tertiary" href={themeEditorUrl} target="_top">Open theme editor</s-button> : null}
            </s-stack>
          </s-stack> : <s-stack gap="base">
            <s-paragraph>You have not created a quiz yet.</s-paragraph>
            <s-stack direction="inline"><s-button variant="primary" href="/app/quizzes/new">Create your first quiz</s-button></s-stack>
          </s-stack>}
        </s-section>

        <s-section heading="Need help?">
          <s-stack gap="small">
            <s-paragraph>Learn how to write questions, link products to answers and customize the quiz design.</s-paragraph>
            <s-stack direction="inline"><s-button href="/app/documentation">Read the documentation</s-button></s-stack>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
