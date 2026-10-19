import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <style>{`body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; } s-page { font-family: inherit; }`}</style>
      <s-app-nav>
        <s-link href="/app" {...{ rel: "home" }}>Home</s-link>
        <s-link href="/app/quizzes">Quizzes &amp; Skin Scan</s-link>
        <s-link href="/app/emails">Collected emails</s-link>
        <s-link href="/app/scan-health">Scanner health</s-link>
        <s-link href="/app/settings">Global Settings</s-link>
        <s-link href="/app/scan-appearance">Skin Scan appearance</s-link>
        <s-link href="/app/documentation">Documentation</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
