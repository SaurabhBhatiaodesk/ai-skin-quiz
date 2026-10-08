# Current implementation review ? 8 October 2026

Static review of current source. This is not proof of a successful real-camera or paid AI session. No runtime behavior was changed during this review.

## Actual flow

1. Merchant saves quizzes, mappings, icons and design in shop-scoped SQLite JSON. AI keys are separately encrypted with AES-256-GCM.
2. Storefront GET /apps/dosha-quiz/quiz loads public configuration through Shopify app-proxy authentication. A saved OpenAI key determines scanReady; it does not prove the key, credits, model or live proxy work.
3. Consent and age confirmation precede camera access. MediaPipe detects face landmarks locally and gates framing, rough yaw and lighting.
4. Current capture is a short countdown, flash and three candidate frames. Only the sharpest ONE image is returned. It does not capture left/right/up/down views, verify liveness, or perform a 30-second multi-angle scan.
5. Backend sends the image to OpenAI for up to two cosmetic observations and approximate image coordinates. It does not send the product catalog to the model.
6. Products are chosen by merchant mapping tags, otherwise fixed product-name anchors. Results show approximate markers over the original browser-held photo. The photo is not included in the persisted report.
7. Reports and email links expire after seven days. Optional Klaviyo event integration can queue delivery; ordinary email capture does not send mail or subscribe customers.

## Findings in priority order

### High ? Capture differs from requested behavior
app/face-scan.js:201-236. The implementation is single-image capture, not verified multi-angle capture. The sweep is a tracking-gated visual guide, not skin measurement. Either implement actual pose-dependent image collection with pause/resume and bounded retries, or describe this honestly as a selfie analysis. Do not imply identity/liveness verification.

### High ? Failed upload analysis can leave no usable upload control
app/storefront-quiz.js:590-599,636. Upload selection hides the upload zone. finishScan clears the captured image and preview on success AND failure, without restoring the upload zone. A network/API failure may require switching modes before retrying. Restore an explicit retake/upload action after failure, and preserve the selected photo for a deliberate retry while consent remains valid.

### High ? Product matching is limited and can lose explanations
app/scan.server.ts:6-10,56-61,76. AI does not assess the actual product catalog. Fallback uses fixed brand/name phrases. Products using unrelated names can be omitted. A mapping requiring multiple concern tags can match the combined concerns, but explanation generation retries each concern separately and loses the match. Return matching evidence together with each product, preserving AND/OR semantics. Use explicit merchant-maintained concern/use-area mappings and verified catalog instructions; do not invent dosage or suitability from a title.

### High for launch ? Readiness and production scale are not established
A stored key is treated as readiness, including keys that cannot decrypt or have invalid billing/model access. Fixed store-wide quota is 60 attempts/hour, consumed before image validation. No per-visitor or in-flight concurrency controls. Real phone/browser coverage, deployed persistent database and end-to-end load validation remain outstanding. Theme enabled is different from provider connected and successful last scan; dashboard should distinguish them.

### Medium ? Email linking has a concurrency race
app/report.server.ts:24-29 reads email, checks it, then updates unconditionally. Two simultaneous unlock requests can pass the empty-email check and overwrite the linked address. Use an atomic conditional update or transaction and verify its outcome.

### Medium ? Active product is not guaranteed purchasable on Online Store
app/quiz.server.ts:795 queries status:active. Catalog model does not establish Online Store publication or availability. Filter/validate sales-channel visibility and variant eligibility before showing purchase links. Scan recommendations also omit selected variant mappings.

### Medium ? Provider selector overstates implemented choice
Gemini and Claude keys can be stored and selected, but scanResult only accepts OpenAI. Selecting another provider disables the scan. Disable unavailable selections or label their capability clearly until adapters and consent wording are complete.

### Medium ? Report/email limits need explicit product decisions
Seven-day deletion and 500 distinct-address maximum are implementation choices, not a complete email CRM. Add pagination and deliberate retention settings if longer/higher-volume usage is needed. Home email count counts email-linked results, not unique people.

### Medium ? Camera/AI dependencies and confidence
MediaPipe assets are fetched from external CDNs without a loader deadline. Landmark pose thresholds and low-light threshold are heuristics; they have not been calibrated across devices and varied appearances. AI marker points are approximate suggestions, not precise validated skin segmentation. Handle loader failure with upload fallback; test real captures before claiming scanner reliability.

## Intended customer experience

Choose scan ? consent ? live face guidance ? capture valid photo(s) ? show captured preview and Retake ? submit for analysis ? observations linked to approximate areas ? relevant available store products, evidence for matching and label-based application guidance. Every failure should offer a visible Retry / Retake / Upload action. Missing concern evidence should say insufficient information; missing catalog matches should say no suitable match rather than fabricate products.

## Checks and limits

Earlier local typecheck/lint/build and regression checks passed. These checks use mocked AI/browser behavior; they do not establish clinical accuracy, real-camera reliability, product suitability or high-traffic readiness. The last actual storefront browser inspection failed before quiz loading with a third-party application error; restarting Shopify dev then required CLI login. This review has not reverified that connection.
