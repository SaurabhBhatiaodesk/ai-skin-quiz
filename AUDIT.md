# Local readiness review ? 8 October 2026

## Verified locally

- Quiz creation starts empty; enabled paths and question validation are tested.
- Quiz edit/save/reload, tag and product mapping regression checks pass.
- Library writes compare the previously read database payload. Racing writes fail visibly instead of silently overwriting another library update. Separate stale editor tabs editing the same quiz still need document-version conflict protection.
- Existing 20-quiz limit is enforced before creation rather than silently dropping quiz 21.
- Disabled theme sections do not count as live. Current readable theme status takes precedence over remembered activation.
- Timestamp reads pass with actual Prisma SQLite and millisecond timestamps.
- Atomic store quota: 100 concurrent local attempts admit exactly 60; another store is independent.
- Report expiry, email unlock, shop isolation, and customer/shop deletion checks pass.
- Request body size is enforced on streamed bytes, including absent Content-Length.
- Camera capture checks cancellation and face validity during capture.
- API keys are encrypted server-side and never returned to storefront loaders.
- Theme JavaScript uses a small loader and shared generated runtime; app config and theme check passed in the preceding review.

## Current behavior and remaining work

- Current scanner is a single-photo flash capture. It is not the previously requested five-angle scanner.
- Real phone/desktop camera, permission denial, iframe camera policy, orientation and low-light behavior need hands-on browser checks.
- Only OpenAI photo analysis is integrated. Gemini/Claude key storage does not enable scanning.
- No live paid AI request was made during this review. Billing/model availability and actual recommendation quality remain unverified here.
- Emails/results expire after seven days. Displaying captured email does not mean sending email or subscribing to marketing. Delivery requires configured Klaviyo integration.
- Collected email view returns at most 500 distinct addresses. Server pagination is needed for higher volume.
- Store-wide scan allowance is fixed at 60 per hour. Per-visitor abuse protection, adjustable quotas and burst/concurrency controls are not implemented.
- SQLite deployment needs persistent storage. Multi-instance production requires a database/deployment design review; local concurrent quota testing is not end-to-end load testing.
- Public quiz submissions and unlock calls need production traffic/abuse assessment. No claim of high-traffic production readiness is made.
- Google Fonts remains a remote-asset performance warning.

## Commands

`npm run typecheck`, `npm run lint`, `npm run build`

`node scripts/check-quiz-layout.mjs`, `node scripts/check-report.mjs`, `node scripts/check-theme.mjs`, `node scripts/check-scan.mjs`, `node scripts/check-timestamps.mjs`, `node scripts/check-editor-events.mjs`
