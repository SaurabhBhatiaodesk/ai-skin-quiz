export default function Documentation() {
  return (
    <s-page heading="Documentation" inlineSize="large">
      <s-stack gap="base">
        <s-paragraph color="subdued">A quick guide to creating, installing and customizing your quiz.</s-paragraph>
        <s-section heading="1. Create a quiz">
          <s-stack gap="small">
            <s-paragraph>Open Blocks, enter a quiz name and choose a quiz type. Press New quiz.</s-paragraph>
            <s-unordered-list>
              <s-list-item>3-block quiz: Quick Quiz, Deep Quiz and AI Skin Scan.</s-list-item>
              <s-list-item>Single-block quiz: one question flow with up to 40 questions.</s-list-item>
              <s-list-item>AI Skin Scan: a camera or photo upload block.</s-list-item>
            </s-unordered-list>
            <s-button href="/app/blocks">Open Blocks</s-button>
          </s-stack>
        </s-section>
        <s-section heading="2. Edit questions and answers">
          <s-stack gap="small">
            <s-paragraph>Press Edit quiz in Blocks. In Quiz edit, select Quick Quiz or Deep Quiz, then select a question. Update the question and answers, or use Add question and Add answer.</s-paragraph>
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
            <s-paragraph>Quiz design controls background, text and button colors, font style and button shape. Press Save design to apply them to this quiz on your storefront.</s-paragraph>
            <s-paragraph>Personalized content controls result names and descriptions. Branching shows the fixed quiz flow and lets you group Deep Quiz questions into baseline, current state and environment sections. Answer-based branching is not available.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="5. Install the Shopify widget">
          <s-stack gap="small">
            <s-paragraph>In Blocks, copy your Shopify widget code, such as john-smith. Press Add block to open the theme editor. Paste the code into the block&apos;s Shopify widget code setting and save the theme.</s-paragraph>
            <s-paragraph>The default dosha-quiz widget code is already filled in. Open your storefront and complete the quiz to check your saved design and product mappings.</s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="AI Skin Scan setup">
          <s-stack gap="small">
            <s-banner heading="Real analysis is not configured">The camera and photo upload screen is available, but a real skin-analysis provider has not been connected. The app does not return fabricated scan results.</s-banner>
            <s-paragraph>Inside the quiz editor, select AI Skin Scan to change its title, description and capture methods. Keep camera or photo upload enabled. Start scan opens the installed widget on your storefront.</s-paragraph>
            <s-paragraph>Photo uploads accept JPG, PNG or WebP files under 5 MB. Camera access requires browser permission and a secure storefront connection.</s-paragraph>
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
