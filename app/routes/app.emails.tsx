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
  return <s-page heading="Collected emails">
    <s-link slot="breadcrumb-actions" href="/app">Home</s-link>
    <s-section heading="Quiz email captures">
      <s-stack gap="base">
        <s-paragraph>Emails submitted with quiz results. Records expire 7 days after the result was created. Email capture does not automatically subscribe a customer to marketing or send an email.</s-paragraph>
        {emails.length ? <s-table><s-table-header-row><s-table-header>Email</s-table-header><s-table-header>Results</s-table-header><s-table-header>Latest result</s-table-header></s-table-header-row><s-table-body>{emails.map(row => <s-table-row key={row.email}><s-table-cell>{row.email}</s-table-cell><s-table-cell>{row.results}</s-table-cell><s-table-cell>{new Date(row.latestResultAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</s-table-cell></s-table-row>)}</s-table-body></s-table> : <s-paragraph>No emails collected yet. Enable the final email capture step in your quiz editor, then save the quiz.</s-paragraph>}
      </s-stack>
    </s-section>
  </s-page>;
}
