import { useState } from "react";
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
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const liveCount = quizzes.filter((quiz) => quiz.live).length;

  return (
    <s-page heading="Home" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create quiz</s-button>
      <s-button slot="secondary-actions" href="/app/documentation">Documentation</s-button>
      <s-stack gap="base">
        <s-banner heading="Welcome to AI Skin Quiz" tone="info">
          <s-paragraph>Follow the three steps below to build your quiz, connect skin analysis and add it to your store.</s-paragraph>
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 240px), 1fr))" gap="base">
          {[
            {label:"Quizzes",value:String(quizzes.length),detail:"Quizzes created",href:"/app/quizzes",icon:"quiz"},
            {label:"Theme blocks",value:themeChecked ? themeActivated ? "Enabled" : "Not added" : "Unverified",detail:themeChecked ? `${liveCount} quiz blocks enabled in the theme` : "Open the theme editor to check",href:themeEditorUrl,icon:"theme"},
            {label:"Results",value:String(stats.results),detail:"Quiz and scan results - last 7 days",href:"",icon:"results"},
            {label:"Emails",value:String(stats.emails),detail:"Email-linked results - last 7 days",href:"/app/emails",icon:"emails"},
          ].map(item => <s-section key={item.label}>
            <div style={{display:"grid",gridTemplateColumns:"72px minmax(0, 1fr)",alignItems:"center",gap:16,minHeight:112}}>
              <s-box inlineSize="72px">
                <s-image src={`/images/onboarding/${item.icon}.svg`} alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" />
              </s-box>
              <div style={{display:"grid",gap:4,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,lineHeight:"20px",color:"#5C6861"}}>{item.label}</div>
                <div style={{minHeight:38,display:"flex",alignItems:"center",fontSize:item.label === "Theme blocks" ? 25 : 32,fontWeight:600,lineHeight:"38px",letterSpacing:"-0.6px",fontVariantNumeric:"tabular-nums",color:item.label === "Theme blocks" && themeChecked && themeActivated ? "#227549" : "#24352D"}}>{item.value}</div>
                <div style={{fontSize:12,lineHeight:"18px",color:"#748078"}}>{item.label === "Results" || item.label === "Emails" ? "Last 7 days" : item.label === "Theme blocks" ? themeChecked ? `${liveCount} ${liveCount === 1 ? "block" : "blocks"} in theme` : "Check theme setup" : "Total quizzes"}</div>
              </div>
            </div>
          </s-section>)}
        </s-grid>
        <s-section heading="Set up your customer experience">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 420px), 1fr))" gap="base">
            {[
              {title:"1. Build your quiz",illustration:"quiz",text:"Add questions, choose entry icons and link suitable store products.",action:"Edit quizzes and products",href:"/app/quizzes"},
              {title:"2. Connect skin analysis",illustration:"scan",text:"Save your OpenAI key and test the connection to enable Skin Scan.",action:"Connect AI",href:"/app/settings"},
              {title:"3. Add to your store",illustration:"theme",text:"Add your quiz block in the theme editor, then preview your storefront.",action:"Open theme editor",href:themeEditorUrl},
            ].map(item => <s-box key={item.title} padding="base" border="base" borderRadius="large">
              <s-grid gridTemplateColumns="72px minmax(0, 1fr) auto" gap="base" alignItems="start">
                <s-box inlineSize="72px">
                  <s-image src={`/images/onboarding/${item.illustration}.svg`} alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" />
                </s-box>
                <s-stack gap="small-200">
                  <s-heading>{item.title}</s-heading>
                  <s-paragraph color="subdued">{item.text}</s-paragraph>
                  <s-link href={item.href} target={item.href === themeEditorUrl ? "_top" : undefined}>{item.action}</s-link>
                </s-stack>
                <s-button icon="arrow-right" href={item.href} target={item.href === themeEditorUrl ? "_top" : undefined} accessibilityLabel={item.action} />
              </s-grid>
            </s-box>)}
          </s-grid>
        </s-section>
        {!calloutDismissed ? <s-section>
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
            <s-grid gridTemplateColumns="@container (inline-size <= 480px) 1fr, 1fr auto" gap="base" alignItems="center">
              <s-stack gap="small">
                <s-heading>{quizzes.length ? "Make Skin Scan match your store" : "Ready to create your first quiz?"}</s-heading>
                <s-paragraph>{quizzes.length ? "Choose your floating button icon, colors and position, then preview it on your storefront." : "Choose a question quiz or Skin Scan, then add your questions and product recommendations."}</s-paragraph>
                <s-stack direction="inline" gap="small">
                  <s-button variant="primary" href={quizzes.length ? "/app/scan-appearance" : "/app/quizzes/new"}>{quizzes.length ? "Customize Skin Scan" : "Create quiz"}</s-button>
                  <s-button variant="tertiary" href="/app/documentation">View setup guide</s-button>
                </s-stack>
              </s-stack>
              <s-box inlineSize="140px">
                <s-image src={`/images/onboarding/${quizzes.length ? "scan" : "quiz"}.svg`} alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" />
              </s-box>
            </s-grid>
            <s-button icon="x" variant="tertiary" accessibilityLabel="Dismiss setup suggestion" onClick={() => setCalloutDismissed(true)} />
          </s-grid>
        </s-section> : null}

      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
