import prisma from "../db.server";
import HomeIllustration from "../components/HomeIllustration";
import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { quizOverview } from "../overview.server";
import { reportStats } from "../report.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const [overview, stats, installedStores] = await Promise.all([quizOverview(session.shop, admin), reportStats(session.shop), prisma.session.groupBy({ by: ["shop"], where: { accessToken: { not: "" } } })]);
  return { ...overview, stats, installCount: installedStores.length };
};

export default function Home() {
  const { quizzes, themeEditorUrl, appEmbedUrl, appEmbedEnabled, stats, installCount } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") revalidator.revalidate();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const timer = !appEmbedEnabled ? window.setInterval(check, 5000) : undefined;
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [appEmbedEnabled, revalidator]);
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const scanWidget = quizzes.find(quiz => quiz.layout === "scan");

  return (
    <s-page heading="Home" inlineSize="large">
      <s-button slot="primary-action" variant="primary" href="/app/quizzes/new">Create Quiz</s-button>
      <s-button slot="secondary-actions" href="/app/documentation">Documentation</s-button>
      <s-stack gap="base">
        <s-banner heading="Welcome to AI Skin Quiz" tone="info">
          <s-paragraph>Follow the three steps below to build your quiz, connect skin analysis and add it to your store.</s-paragraph>
        </s-banner>

        {!appEmbedEnabled && <s-section heading="Enable app in your store">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
            <s-paragraph>Enable AI Skin Quiz in your store and save your theme once. The floating button appears automatically when Skin Scan is connected. Creating more widgets does not require enabling the app again.</s-paragraph>
            <s-button variant="primary" icon="store" href={appEmbedUrl} target="_blank">Enable app in store</s-button>
          </s-stack>
        </s-section>}
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 240px), 1fr))" gap="base">
          {[
            {label:"Installed stores",value:String(installCount),detail:"Current installations",href:"",icon:"theme"},
            {label:"Quizzes",value:String(quizzes.length),detail:"Quizzes created",href:"/app/quizzes",icon:"quiz"},
            {label:"Results",value:String(stats.results),detail:"Quiz and scan results - last 7 days",href:"",icon:"results"},
            {label:"Emails",value:String(stats.emails),detail:"Email-linked results - last 7 days",href:"/app/emails",icon:"emails"},
          ].map(item => <s-section key={item.label}>
            <div style={{display:"grid",gridTemplateColumns:"72px minmax(0, 1fr)",alignItems:"center",gap:16,minHeight:112}}>
              <s-box inlineSize="72px">
                <HomeIllustration name={item.icon} />
              </s-box>
              <div style={{display:"grid",gap:4,minWidth:0}}>
                <div style={{minHeight:38,display:"flex",alignItems:"center",fontSize:24,fontWeight:600,lineHeight:"32px",letterSpacing:"-0.6px",fontVariantNumeric:"tabular-nums",color:"#000000"}}>{item.value}</div>
                <div style={{fontSize:15,fontWeight:600,lineHeight:"22px",color:"#000000"}}>{item.label}</div>
                <div style={{fontSize:11,lineHeight:"17px",color:"#000000"}}>{item.label === "Results" || item.label === "Emails" ? "Last 7 days" : item.label === "Installed stores" ? "Current installations" : "Total quizzes"}</div>
              </div>
            </div>
          </s-section>)}
        </s-grid>
        {scanWidget ? <s-section>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,flexWrap:"wrap",padding:"4px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:18,flex:"1 1 340px",minWidth:0}}>
              <div style={{width:80,flexShrink:0,padding:6,borderRadius:16,background:"#F1F6F2"}}><HomeIllustration name="scan" /></div>
              <div style={{display:"grid",gap:7,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <s-heading>{scanWidget.name}</s-heading>
                  <span style={{fontSize:11,fontWeight:600,lineHeight:"18px",padding:"2px 8px",borderRadius:6,background:scanWidget.live ? "#E4F3E8" : "#F0F1F1",color:scanWidget.live ? "#245B37" : "#555C58"}}>{scanWidget.live ? "Live in theme" : "Scan widget"}</span>
                </div>
                <div style={{fontSize:13,lineHeight:"20px",color:"#616964"}}>Consent, photo and personalized skin results.</div>
                <div style={{fontSize:11,lineHeight:"18px",color:"#757C77"}}>Widget ID <span style={{fontVariantNumeric:"tabular-nums",color:"#47514A",marginLeft:6}}>{scanWidget.handle}</span></div>
              </div>
            </div>
            <s-stack direction="inline" gap="small">
              <s-button icon="edit" href={`/app/editor?quiz=${encodeURIComponent(scanWidget.handle)}`}>Edit Skin Scan</s-button>
              <s-button icon="store" variant="primary" href={scanWidget.addUrl} target="_top">Add to theme</s-button>
            </s-stack>
          </div>
        </s-section> : null}
        <s-section heading="Set up your customer experience">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 420px), 1fr))" gap="base">
            {[
              {title:"1. Build your quiz",illustration:"quiz",text:"Add questions, choose entry icons and link suitable store products.",action:"Edit quizzes and products",href:"/app/quizzes"},
              {title:"2. Connect skin analysis",illustration:"scan",text:"Save your OpenAI key and test the connection to enable Skin Scan.",action:"Connect AI",href:"/app/settings"},
              {title:"3. Add to your store",illustration:"theme",text:"Add your quiz block in the theme editor, then preview your storefront.",action:"Open theme editor",href:themeEditorUrl},
            ].map(item => <s-box key={item.title} padding="base" border="base" borderRadius="large">
              <s-grid gridTemplateColumns="72px minmax(0, 1fr) auto" gap="base" alignItems="start">
                <s-box inlineSize="72px">
                  <HomeIllustration name={item.illustration} />
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
                  <s-button variant="primary" href={quizzes.length ? "/app/scan-appearance" : "/app/quizzes/new"}>{quizzes.length ? "Customize Skin Scan" : "Create Quiz"}</s-button>
                  <Link to="/app/documentation" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:34,padding:"0 14px",boxSizing:"border-box",border:"1px solid #B6CCBE",borderRadius:8,background:"#DCEBE1",color:"#284D37",fontSize:13,fontWeight:600,lineHeight:"20px",textDecoration:"none",boxShadow:"0 1px 1px #0000000D"}}>View setup guide</Link>
                </s-stack>
              </s-stack>
              <s-box inlineSize="140px">
                <HomeIllustration name={quizzes.length ? "scan" : "quiz"} />
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
