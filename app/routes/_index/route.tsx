import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData, useSubmit, useNavigation } from "react-router";
import { useState } from "react";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;
  const [shop, setShop] = useState("");
  const submit = useSubmit();
  const navigation = useNavigation();

  return (
    <>
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      <s-page heading="AI Skin Quiz">
        <s-section heading="Create personalized skin quizzes">
          <s-stack gap="base">
            <s-paragraph>Create quizzes, tag answers and recommend products from your Shopify store.</s-paragraph>
        {showForm && (
          <Form method="post" onSubmit={event => { event.preventDefault(); if (shop.trim()) submit({ shop: shop.trim() }, { method: "post" }); }}>
            <s-stack gap="base">
              <s-text-field label="Shop domain" name="shop" required value={shop} details="e.g. my-shop-domain.myshopify.com" error={errors?.shop} onInput={event => setShop(event.currentTarget.value)} />
              <s-stack direction="inline"><s-button type="submit" variant="primary" loading={navigation.state !== "idle"} disabled={!shop.trim()}>Log in</s-button></s-stack>
            </s-stack>
          </Form>
        )}
          </s-stack>
        </s-section>
      </s-page>
    </>
  );
}
