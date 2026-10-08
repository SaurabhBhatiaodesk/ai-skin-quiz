import type { ReactNode } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { quizOverview } from "../overview.server";
import { reportStats } from "../report.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const [overview, stats] = await Promise.all([quizOverview(session.shop, admin), reportStats(session.shop)]);
  return { ...overview, stats };
};

const statIcons: Record<string, ReactNode> = {
  Quizzes: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  Storefront: <><path d="M3 10 5 3h14l2 7M4 10v11h16V10M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7" /></>,
  Results: <><path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5" /></>,
  Emails: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
};
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="dashboard-stat" style={{ background: "#fff", padding: 20, display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", alignContent: "start", columnGap: 12, rowGap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: "#e3f1df", color: "#29845a", gridRow: "1 / 3" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{statIcons[label]}</svg>
      </span>
      <span style={{ fontSize: 13, lineHeight: "18px", color: "#616161" }}>{label === "Emails" ? <s-link href="/app/emails">{label}</s-link> : label}</span>
      <strong style={{ fontSize: label === "Storefront" ? 20 : 26, lineHeight: "28px", color: label === "Storefront" && value === "Active" ? "#29845a" : "#303030", marginTop: -6 }}>{value}</strong>
      <span style={{ gridColumn: "1 / -1", fontSize: 13, lineHeight: "18px", color: "#616161", overflowWrap: "anywhere" }}>{detail}</span>
    </div>
  );
}

export default function Home() {
  const { quizzes, themeChecked, themeActivated, stats } = useLoaderData<typeof loader>();
  const liveCount = quizzes.filter((quiz) => quiz.live).length;

  return (
    <s-page heading="Home" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create quiz</s-button>
      <s-button slot="secondary-actions" href="/app/documentation">Documentation</s-button>
      <s-stack gap="base">
        <style>{`
          .dashboard-content { max-width: 1200px; margin-inline: auto; display: grid; gap: 20px; }
          .dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #dedede; border-radius: 14px; overflow: hidden; background: white; }
          .dashboard-stat + .dashboard-stat { border-left: 1px solid #ebebeb; }
          .dashboard-resources { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .dashboard-resource { display: flex; align-items: center; justify-content: space-between; gap: 20px; background: white; border: 1px solid #dedede; border-radius: 12px; padding: 20px; }
          @media(max-width: 850px) { .dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-stat:nth-child(3) { border-left: 0; } .dashboard-stat:nth-child(n+3) { border-top: 1px solid #ebebeb; } .dashboard-resources { grid-template-columns: 1fr; } }
          @media(max-width: 450px) { .dashboard-resource { align-items: flex-start; flex-direction: column; } }
        `}</style>
        <div className="dashboard-content">
        <div className="dashboard-welcome" style={{ background: "#eaf4ed", border: "1px solid #d4e5d9", borderRadius: 14, padding: "24px", display: "flex", alignItems: "center", gap: 16 }}>
          <span className="dashboard-scan-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 48, height: 48, borderRadius: 14, background: "#dceee0", color: "#23794e" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" /><path d="M9 9h.01M15 9h.01M9 15c2 1.5 4 1.5 6 0M12 10v3" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>

            <h2 style={{ margin: "0 0 6px", fontSize: "clamp(22px, 2vw, 28px)", lineHeight: 1.25, letterSpacing: "-0.5px", fontWeight: 650, color: "#213c2c" }}>Welcome to AI Skin Quiz</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#52645a", maxWidth: 640 }}>Manage your quizzes, review results and personalize your customers? skin rituals.</p>
          </div>
        </div>

        <div className="dashboard-metrics">
          <Stat label="Quizzes" value={String(quizzes.length)} detail={quizzes.length === 1 ? "1 quiz created" : `${quizzes.length} quizzes created`} />
          <Stat label="Storefront" value={themeActivated ? "Active" : "Not active"} detail={themeChecked ? `${liveCount} live in your theme` : themeActivated ? "Quiz block added to your theme" : "Add the quiz block to your theme"} />
          <Stat label="Results" value={String(stats.results)} detail="Completed in the last 7 days" />
          <Stat label="Emails" value={String(stats.emails)} detail="Collected in the last 7 days" />
        </div>

        <div className="dashboard-resources">
          <div className="dashboard-resource">
            <div><h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#303030" }}>Skin Scan appearance</h3><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#616161" }}>Customize your scan button, colors and position.</p></div>
            <s-button href="/app/scan-appearance">Customize</s-button>
          </div>
          <div className="dashboard-resource">
            <div><h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#303030" }}>Help and documentation</h3><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#616161" }}>Guides for questions, product matching and design.</p></div>
            <s-button href="/app/documentation">View guides</s-button>
          </div>
        </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
