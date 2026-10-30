# Shopify app development

This app is scaffolded from a Shopify app template. See the README for framework-specific details.

Use the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) for all Shopify API and platform work. If missing, install it in the agent host per that page (or `npx skills add Shopify/shopify-ai-toolkit --list` for skill-compatible hosts) — do not add tooling to this repo.

## Storefront widget

Edit the widget source in `app/storefront-quiz.js` and `app/storefront-quiz.css`, then run `npm run build:widget`. The files in `extensions/dosha-quiz/assets/` (`dosha-quiz-runtime.js`, `dosha-quiz.css`, `dosha-quiz-extra.css`) are generated; do not edit them by hand.
