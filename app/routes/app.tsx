import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, useNavigation } from "react-router";
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
  const navigation = useNavigation();
  const loadingPage = navigation.state === "loading" && !navigation.formMethod;

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app" {...{ rel: "home" }}>Home</s-link>
        <s-link href="/app/quizzes">Quizzes</s-link>
        <s-link href="/app/emails">Collected emails</s-link>
        <s-link href="/app/settings">Global Settings</s-link>
        <s-link href="/app/scan-appearance">Skin Scan appearance</s-link>
        <s-link href="/app/documentation">Documentation</s-link>
      </s-app-nav>
      {loadingPage ? <div role="status" aria-live="polite" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:16}}>
        <s-spinner accessibilityLabel="Loading page" size="large-100" />
        <s-text color="subdued">Loading page</s-text>
      </div> : null}
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
