import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { collectedEmails } from "../report.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return { emails: await collectedEmails(session.shop) };
}
export default function Emails() {
  const { emails } = useLoaderData<typeof loader>();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("newest");
  const filtered = emails.filter(row => row.email.toLowerCase().includes(query.trim().toLowerCase()) && (period === "all" || row.latestResultAt >= Date.now() - Number(period) * 86400000)).sort((a, b) => sort === "email" ? a.email.localeCompare(b.email) : sort === "results" ? b.results - a.results : sort === "oldest" ? a.latestResultAt - b.latestResultAt : b.latestResultAt - a.latestResultAt);
  return <s-page heading="Collected emails" inlineSize="large">
    <s-link slot="breadcrumb-actions" href="/app">Home</s-link>
    <s-section heading="Quiz email captures">
      <s-stack gap="base">
        <s-paragraph>Emails submitted with quiz results. Records expire 7 days after the result was created. Email capture does not automatically subscribe a customer to marketing or send an email.</s-paragraph>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <s-search-field label="Search emails" placeholder="Search by email address" value={query} onInput={event => setQuery(event.currentTarget.value)} />
          <s-select label="Latest result date" value={period} onChange={event => setPeriod(event.currentTarget.value)}><s-option value="all">All available (7 days)</s-option><s-option value="1">Last 24 hours</s-option><s-option value="3">Last 3 days</s-option></s-select>
          <s-select label="Sort by" value={sort} onChange={event => setSort(event.currentTarget.value)}><s-option value="newest">Newest result first</s-option><s-option value="oldest">Oldest result first</s-option><s-option value="email">Email A to Z</s-option><s-option value="results">Most results</s-option></s-select>
        </div>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{filtered.length} of {emails.length} email addresses</s-text>
          {query || period !== "all" || sort !== "newest" ? <s-button variant="tertiary" onClick={() => { setQuery(""); setPeriod("all"); setSort("newest"); }}>Reset filters</s-button> : null}
        </s-stack>
        {filtered.length ? <s-table><s-table-header-row><s-table-header>Email</s-table-header><s-table-header>Results</s-table-header><s-table-header>Latest result</s-table-header></s-table-header-row><s-table-body>{filtered.map(row => <s-table-row key={row.email}><s-table-cell>{row.email}</s-table-cell><s-table-cell>{row.results}</s-table-cell><s-table-cell>{new Date(row.latestResultAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</s-table-cell></s-table-row>)}</s-table-body></s-table> : <s-paragraph>{emails.length ? "No emails match your search or filters." : "No emails collected yet. Enable the final email capture step in your quiz editor, then save the quiz."}</s-paragraph>}
      </s-stack>
    </s-section>
  </s-page>;
}
