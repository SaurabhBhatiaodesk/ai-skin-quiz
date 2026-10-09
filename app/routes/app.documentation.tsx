export default function Documentation() {
  return (
    <s-page heading="Documentation" inlineSize="large">
      <s-button slot="breadcrumb-actions" href="/app" accessibilityLabel="Back to home">Home</s-button>
      <s-stack gap="base">
        <s-paragraph color="subdued">A quick guide to creating, installing and customizing your quiz.</s-paragraph>
        <s-section heading="1. Create a quiz">
          <s-stack gap="small">
            <s-paragraph>Open Quizzes and press Create quiz. Enter a name, choose Single or Combined, select the quiz paths, then press Create quiz. The new quiz opens in the editor, ready for its questions.</s-paragraph>
            <s-unordered-list>
              <s-list-item>Combined Quiz: choose any two or all three paths.</s-list-item>
              <s-list-item>Single Quiz: Quick Skin Quiz or Dosha Quiz.</s-list-item>
              <s-list-item>Only Skin Scan: a dedicated camera or photo upload block. Create an Only Skin Scan widget, add this app block in the theme editor, and paste its numeric widget ID.</s-list-item>
            </s-unordered-list>
            <s-button href="/app/quizzes/new">Create quiz</s-button>
          </s-stack>
        </s-section>
        <s-section heading="2. Edit questions and answers">
          <s-stack gap="small">
            <s-paragraph>Click a saved quiz card or its Edit quiz button. In Quiz edit, select Quick Quiz or Deep Quiz, then select a question. Update the question and answers, or use Add question and Add answer.</s-paragraph>
            <s-paragraph>Question lists show five questions per page. Use Previous and Next to navigate. Press Save to keep your changes.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="3. Map answers to products">
          <s-stack gap="small">
            <s-paragraph>In Answer tags, add tags to each answer. Separate multiple tags with commas and press Save tags.</s-paragraph>
            <s-paragraph>Open Link product and press New mapping. Select tags, choose a product or variant, then press Save mapping.</s-paragraph>
            <s-unordered-list>
              <s-list-item>AND: all selected tags must match the customer&apos;s answers.</s-list-item>
              <s-list-item>OR: any selected tag can match.</s-list-item>
            </s-unordered-list>
            <s-paragraph>For example, tag an answer dry_skin and map dry_skin to your moisturizer. Customers who choose that answer will see the mapped product. Results show matching store products; no match shows an empty result message.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="4. Customize the design and result">
          <s-stack gap="small">
            <s-paragraph>Quiz design controls background, text and button colors, font style and button shape. Press Save to apply them to this quiz on your storefront.</s-paragraph>
            <s-paragraph>Personalized content controls result names and descriptions. Branching shows the fixed quiz flow and lets you group Deep Quiz questions into baseline, current state and environment sections. Answer-based branching is not available.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="Cover image, profile image and Widget CSS">
          <s-paragraph>In Settings, edit the quiz name, cover image URL and profile image URL using HTTPS images from Shopify Files. Custom CSS adds your own styles on top of the default quiz design; leave it empty to use the defaults.</s-paragraph>
        </s-section>
        <s-section heading="5. Install the Shopify widget">
          <s-stack gap="small">
            <s-paragraph>In the quiz editor Settings, copy your Shopify widget code. On the quiz card, use Add to theme. Paste the code into the block&apos;s Shopify widget code setting and save the theme.</s-paragraph>
            <s-paragraph>For Custom Liquid, copy the complete embed code from Settings, paste it into a Custom Liquid section and save. The embedded quiz adjusts its height automatically.</s-paragraph><s-paragraph>Choose the theme block matching your quiz type and paste its widget code. Open your storefront and complete the quiz to check your saved design and product mappings.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="AI Skin Scan setup">
          <s-stack gap="small">
            <s-banner tone="info" heading="OpenAI photo analysis">Add your OpenAI API key in Global Settings. The scan describes visible cosmetic concerns and recommends matching store products. It does not measure dosha or internal skin health.</s-banner>
            <s-paragraph>For a quiz containing the scan path, select AI Skin Scan to change its title, description and capture methods. Keep camera or photo upload enabled. Start scan opens the installed widget on your storefront.</s-paragraph>
            <s-paragraph>Photo uploads accept JPG, PNG or WebP files under 5 MB. Camera access requires browser permission and a secure storefront connection.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="Developer API: quiz data">
          <s-stack gap="base">
            <s-paragraph>Fetch saved quiz configuration from the same Shopify storefront through the app proxy. Replace YOUR_WIDGET_ID with the saved quiz widget ID.</s-paragraph>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{`const response = await fetch('/apps/dosha-quiz/quiz?code=YOUR_WIDGET_ID');
if (!response.ok) throw new Error('Quiz not available');
const quiz = await response.json();
// quiz.quick, quiz.deep, quiz.design, quiz.widgetCss, quiz.emailCapture`}</pre>
            <s-paragraph>Score answers with POST /apps/dosha-quiz/result using JSON: code, path (quick or deep), and answers (zero-based option indexes). The response contains result and matching store products. Deep report details remain email-gated.</s-paragraph>
            <s-paragraph>All saved block types use the same API with their own widget ID: layout three is Combined Quiz, single is Single Quiz, and scan is AI Skin Scan. Use enabledPaths to decide which choices to display; use singleFlow for the Single Quiz path. Design and cardIcons are optional starting points for your custom interface.</s-paragraph>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{`// Collect one zero-based option index for every question in the selected path.
const answers = selectedOptionIndexes;
const response = await fetch('/apps/dosha-quiz/result', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ code: quiz.handle, path: 'quick', answers })
});
const data = await response.json();
if (!response.ok || !data.ok) throw new Error(data.error || 'Submission failed');
// Render data.result and data.result.products in your custom design.`}</pre>
            <s-paragraph>For deep questions, use path deep and indexes from quiz.deep. When email capture is required, include email. For a locked deep report, POST intent unlock, reportId and email to the same result endpoint.</s-paragraph>
            <s-paragraph>For Skin Scan, check scanReady before offering analysis. Capture or upload a clear JPEG, PNG or WebP data URL, then POST code, path scan, images [photoDataUrl], consent true and adult true. Obtain explicit photo-processing consent and age confirmation first; never hardcode them without user agreement. The API returns cosmetic observations and matching products, not a medical diagnosis. Camera access, face tracking and photo preparation belong in your custom frontend. Analysis still uses the merchant&apos;s configured provider credits.</s-paragraph>
            <s-paragraph>These endpoints use Shopify app-proxy authentication. Call them from the storefront domain; direct unauthenticated requests to the app server are rejected. They do not expose API keys, customer reports or scoring weights.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="Troubleshooting">
          <s-unordered-list>
            <s-list-item>Widget missing: check that the app block is added to the homepage and the theme is saved.</s-list-item>
            <s-list-item>Wrong quiz opens: check the Shopify widget code in the theme block.</s-list-item>
            <s-list-item>No products appear: check saved answer tags, AND/OR grouping and the selected product or variant. Store product access must be available.</s-list-item>
            <s-list-item>Changes are missing: save in the app, then refresh the storefront.</s-list-item>
          </s-unordered-list>
        </s-section>
      </s-stack>
    </s-page>
  );
}
