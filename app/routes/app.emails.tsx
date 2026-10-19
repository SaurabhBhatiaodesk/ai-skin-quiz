import { emailCsv } from "../email-export";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { collectedEmails, emailDeliverySummary } from "../report.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const [emails, delivery] = await Promise.all([collectedEmails(session.shop), emailDeliverySummary(session.shop)]);
  return { emails, delivery };
}
export default function Emails() {
  const { emails, delivery } = useLoaderData<typeof loader>();
  const [query, setQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const filtered = emails.filter(row => (deliveryFilter === "all" || (deliveryFilter === "failed" ? row.failed > 0 : deliveryFilter === "queued" ? row.queued > 0 : row.queued === 0 && row.failed === 0)) && row.email.toLowerCase().includes(query.trim().toLowerCase()) && (period === "all" || row.latestResultAt >= Date.now() - Number(period) * 86400000)).sort((a, b) => sort === "email" ? a.email.localeCompare(b.email) : sort === "results" ? b.results - a.results : sort === "oldest" ? a.latestResultAt - b.latestResultAt : b.latestResultAt - a.latestResultAt);
  const pageSize = 25;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visibleEmails = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <s-page heading="Collected emails" inlineSize="large">
    <s-button slot="primary-action" disabled={!filtered.length} onClick={() => { const url=URL.createObjectURL(new Blob([emailCsv(filtered)],{type:"text/csv;charset=utf-8"})); const link=document.createElement("a");link.href=url;link.download="quiz-emails.csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }}>Export filtered CSV</s-button>
    <s-link slot="breadcrumb-actions" href="/app">Home</s-link>
    <s-stack gap="base">
    <s-section heading="Email delivery status">
      <s-stack gap="base">
        <s-badge tone={delivery.configured ? "success" : "warning"}>{delivery.configured ? "Klaviyo connected" : "Delivery not configured"}</s-badge>
        <s-paragraph>{delivery.configured ? "Events are sent to Klaviyo. Configure a Klaviyo flow to send the report email; queued does not confirm inbox delivery." : "Email addresses are captured, but this store has no email delivery integration configured. Customers can still view their unlocked results."}</s-paragraph>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16}}>{[["Captured reports",delivery.captured],["Queued events",delivery.queued],["Failed delivery attempts",delivery.failed]].map(([label,count])=><div key={label} style={{padding:16,border:"1px solid #e3e6e3",borderRadius:12}}><s-text color="subdued">{label}</s-text><div style={{fontSize:24,fontWeight:600,marginTop:8}}>{count}</div></div>)}</div>
        <s-text color="subdued">Counts cover retained reports from the last 7 days. Failures are recorded from this update onward.</s-text>
      </s-stack>
    </s-section>
    <s-section heading="Quiz email captures">
      <s-stack gap="base">
        <s-paragraph>Emails submitted with quiz results. Records expire 7 days after the result was created. Email capture does not automatically subscribe a customer to marketing or send an email.</s-paragraph>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <s-search-field label="Search emails" placeholder="Search by email address" value={query} onInput={event => { setQuery(event.currentTarget.value); setPage(0); }} />
          <s-select label="Latest result date" value={period} onChange={event => { setPeriod(event.currentTarget.value); setPage(0); }}><s-option value="all">All available (7 days)</s-option><s-option value="1">Last 24 hours</s-option><s-option value="3">Last 3 days</s-option></s-select>
          <s-select label="Delivery status" value={deliveryFilter} onChange={event => {setDeliveryFilter(event.currentTarget.value);setPage(0);}}><s-option value="all">All statuses</s-option><s-option value="failed">Has failed report</s-option><s-option value="queued">Has queued event</s-option><s-option value="captured">Captured only</s-option></s-select>
          <s-select label="Sort by" value={sort} onChange={event => { setSort(event.currentTarget.value); setPage(0); }}><s-option value="newest">Newest result first</s-option><s-option value="oldest">Oldest result first</s-option><s-option value="email">Email A to Z</s-option><s-option value="results">Most results</s-option></s-select>
        </div>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{filtered.length} of {emails.length} email addresses</s-text>
          {query || period !== "all" || sort !== "newest" || deliveryFilter !== "all" ? <s-button variant="secondary" onClick={() => { setQuery(""); setDeliveryFilter("all"); setPeriod("all"); setSort("newest"); setPage(0); }}>Reset filters</s-button> : null}
        </s-stack>
      </s-stack>
    </s-section>
    <s-section padding="none">
        {filtered.length ? <s-table paginate={filtered.length > pageSize} hasPreviousPage={currentPage > 0} hasNextPage={(currentPage + 1) * pageSize < filtered.length} onPreviousPage={() => setPage(Math.max(0, currentPage - 1))} onNextPage={() => setPage(currentPage + 1)}><s-table-header-row><s-table-header listSlot="primary">Email</s-table-header><s-table-header listSlot="labeled"><div style={{ width: "clamp(120px, 20vw, 320px)" }}>Quiz results</div></s-table-header><s-table-header listSlot="labeled">Delivery</s-table-header><s-table-header listSlot="labeled"><div style={{ width: "clamp(150px, 20vw, 320px)" }}>Latest result</div></s-table-header></s-table-header-row><s-table-body>{visibleEmails.map(row => <s-table-row key={row.email}><s-table-cell><s-text type="strong">{row.email}</s-text></s-table-cell><s-table-cell><s-text>{row.results}</s-text></s-table-cell><s-table-cell><s-stack gap="small"><s-text>{row.queued} queued</s-text><s-text>{row.failed} failed</s-text></s-stack></s-table-cell><s-table-cell>{new Date(row.latestResultAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</s-table-cell></s-table-row>)}</s-table-body></s-table> : <s-stack gap="small">
          {!emails.length ? <s-stack alignItems="center"><s-box inlineSize="120px"><s-image src="/images/onboarding/emails.svg" alt="" accessibilityRole="presentation" aspectRatio="5 / 4" objectFit="contain" /></s-box></s-stack> : null}
          <s-empty-state heading={emails.length ? "No emails match these filters" : "No emails collected yet"}>
          {emails.length ? <s-icon slot="graphic" type="search" /> : null}
          <s-text slot="subheading">{emails.length ? "Try another email address or reset the filters." : "Enable email capture in your quiz. Addresses will appear here after customers submit their results."}</s-text>
          {emails.length ? <s-button slot="primary-action" variant="primary" onClick={() => { setQuery(""); setDeliveryFilter("all"); setPeriod("all"); setSort("newest"); setPage(0); }}>Reset filters</s-button> : <s-button slot="primary-action" variant="primary" href="/app/quizzes">View quizzes</s-button>}
        </s-empty-state></s-stack>}
    </s-section>
    </s-stack>
  </s-page>;
}
