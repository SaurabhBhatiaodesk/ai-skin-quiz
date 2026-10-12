# Production release

Target: `prana-ai-skin-quiz`, Shopify app `7c7f0cc16b5b8d2c0ea9bd2158176233`.

Prepared and checked:
- `shopify.app.production.toml`: Heroku application, OAuth callback and proxy URLs; live extension configuration.
- PostgreSQL schema and migration under `prisma/production`; local SQLite remains supported.
- Database setup chooses PostgreSQL when DATABASE_URL is set.
- SQL parameters remain bound; timestamp columns support milliseconds.
- `scripts/migrate-sqlite-data.mjs` defaults to read-only counts; apply uses a transaction and never overwrites existing rows.

Release after approval:
1. Provision `heroku-postgresql:essential-0` on `prana-ai-skin-quiz` ($5/month extra).
2. Deploy the prepared backend with DATABASE_URL, and require persistent storage.
3. Back up the local database and migrate existing quiz/settings records; verify counts and widget IDs before Shopify release. Keep source SQLite unchanged.
4. Stop the local Shopify dev preview before releasing live URLs, so its tunnel cannot replace production URLs.
5. Run `shopify app deploy --config production --allow-updates --no-input`. This publishes the production URLs and theme extension to merchants.
6. Verify web startup, HTTP response, database persistence across restart, app proxy, and storefront widget selection.

No paid database was provisioned and no production Shopify release was made during preparation.
