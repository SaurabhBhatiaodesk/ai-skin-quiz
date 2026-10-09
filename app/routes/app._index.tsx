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

export default function Home() {
  const { quizzes, themeChecked, themeActivated, themeEditorUrl, stats } = useLoaderData<typeof loader>();
  const liveCount = quizzes.filter((quiz) => quiz.live).length;

  return (
    <s-page heading="Home" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create quiz</s-button>
      <s-button slot="secondary-actions" href="/app/documentation">Documentation</s-button>
      <s-stack gap="base">
        <s-banner heading="Welcome to AI Skin Quiz" tone="info">
          <s-paragraph>Follow the three steps below to build your quiz, connect skin analysis and add it to your store.</s-paragraph>
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          {[
            {label:"Quizzes",value:String(quizzes.length),detail:"Quizzes created",href:"/app/quizzes",icon:"clipboard-list"},
            {label:"Theme blocks",value:themeChecked ? themeActivated ? "Enabled" : "Not added" : "Unverified",detail:themeChecked ? `${liveCount} quiz blocks enabled in the theme` : "Open the theme editor to check",href:themeEditorUrl,icon:"store"},
            {label:"Results",value:String(stats.results),detail:"Quiz and scan results - last 7 days",href:"",icon:"chart-column"},
            {label:"Emails",value:String(stats.emails),detail:"Email-linked results - last 7 days",href:"/app/emails",icon:"mail"},
          ].map(item => <s-section key={item.label}>
            <s-stack gap="small" alignItems="center">
              <s-box inlineSize="48px" minInlineSize="48px">
                <s-image src={`/images/dashboard/${item.icon}.svg`} alt="" accessibilityRole="presentation" aspectRatio="1 / 1" objectFit="contain" />
              </s-box>
              <s-stack gap="small-200" alignItems="center">
                <div style={{fontSize:14,fontWeight:600,lineHeight:1.4,color:"#414b45",textAlign:"center"}}>{item.label}</div>
                <div style={{textAlign:"center",fontSize:item.label === "Theme blocks" ? 24 : 30,fontWeight:600,lineHeight:1.25,letterSpacing:"-0.4px",color:item.label === "Theme blocks" && themeChecked && themeActivated ? "#227549" : "#172b3a"}}>{item.value}</div>
                <div style={{fontSize:12,lineHeight:1.5,color:"#707771",textAlign:"center"}}>{item.label === "Results" || item.label === "Emails" ? "Last 7 days" : item.label === "Theme blocks" ? themeChecked ? `${liveCount} ${liveCount === 1 ? "block" : "blocks"} in theme` : "Check theme setup" : "Total quizzes"}</div>
              </s-stack>
            </s-stack>
          </s-section>)}
        </s-grid>
        <s-section heading="Set up your customer experience">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
            {[
              {title:"1. Build your quiz",icon:"clipboard" as const,text:"Add questions, choose entry icons and link suitable store products.",action:"Edit quizzes and products",href:"/app/quizzes"},
              {title:"2. Connect skin analysis",icon:"connect" as const,text:"For Skin Scan, save your OpenAI key and test the connection. Question-only quizzes can skip this step.",action:"Connect AI",href:"/app/settings"},
              {title:"3. Add to your store",icon:"store" as const,text:"Add the matching quiz block, enter its widget code and complete a storefront test.",action:"Open theme editor",href:themeEditorUrl},
            ].map(item => <s-box key={item.title} padding="base" border="base" borderRadius="large" background="subdued">
              <s-stack gap="base">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-icon type={item.icon} size="base" />
                  <s-heading>{item.title}</s-heading>
                </s-stack>
                <s-paragraph>{item.text}</s-paragraph>
                <s-stack direction="inline"><s-button href={item.href} target={item.href === themeEditorUrl ? "_top" : undefined}>{item.action}</s-button></s-stack>
              </s-stack>
            </s-box>)}
          </s-grid>
        </s-section>
        <s-section heading="After setup">
          <s-stack gap="base">
            <s-paragraph>Customer flow: choose a quiz or Skin Scan, answer questions or capture a photo, then view observations and matching products.</s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button href="/app/scan-appearance">Customize scan button</s-button>
              <s-button href="/app/emails">View collected emails</s-button>
              <s-button href="/app/documentation">Setup help</s-button>
            </s-stack>
            <s-paragraph color="subdued">A theme block being enabled does not confirm that camera capture and AI analysis work. Complete a real storefront test before sharing with customers.</s-paragraph>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
