# z-Index Starter

Complete source release: **2026-11-15 — launch operations**. React 19, Express 5, Prisma 6.19.3, PostgreSQL 18, Node 24. Global Starter: **USD 19.99 monthly / USD 199.99 yearly**. Azerbaijan prices are unchanged. `shared/pricing.json` is the shared source of subscription prices; workspace operating currency is independent.

## Upgrade an existing installation

Follow [BASLA_BURADAN.md](BASLA_BURADAN.md). Stop app and worker processes, back up the database **and uploads**, preserve private `.env` files and images, install locked dependencies, run `prisma migrate deploy`, then generate Prisma Client. This release adds migration `202611150003_launch_operations` on top of the previous opening-balance and session migrations. Never use `migrate reset` or `db push` on business data.

## Included in this release

- Customer contact edit with stale-record protection; invoice snapshots and opening balances remain historical.
- Admin purchase correction/void with a mandatory reason, stock reconciliation, revision history and repeat-request protection.
- Operator company search/pagination, password and worker PIN recovery, manual subscription extension, activation/deactivation and audit history. Operator secret stays server-side and in browser memory only.
- Support email draft composer for Gmail or the user's mail app. Customers review and send the draft themselves; no SMTP credentials are required for this support workflow.
- Private company logo on the dashboard and in PDF invoices.
- Monthly net sales: sales posted this month less returns posted this month, in the company's timezone. Payments and customer cash refunds do not subtract from sales again.
- Previous audited accounting, tenant isolation, Excel/CSV opening-balance import, four languages, purchasing workflow, invoice detail redesign and Group 7 features.

## New local installation

Use an empty dedicated PostgreSQL database. Copy `server/.env.example` to `server/.env`; configure the database and independently generated server secrets. From `server`, run `npm ci`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run dev`. From `client`, run `npm ci` and `npm run dev`. Open `/operator/companies` to provision companies using your private operator secret; no public registration or shared default production PIN is provided.

## Verification

```sh
npm --prefix server test
npm --prefix client test
npm --prefix client run lint -- --max-warnings=0
npm --prefix client run build
```

Native checks require a dedicated localhost database ending in `_test`, set through `NATIVE_DATABASE_URL`, and PostgreSQL 18 backup tools via `PG_BIN`:

```sh
npm --prefix server run test:native
```

They test concurrency, backup/restore, all migrations on a clean database and the production file layout with built UI. The Git index guard runs inside your actual checkout using `npm --prefix server run repo:check`. Old files in remote Git history require separate remediation; a source ZIP cannot erase them.

## Deployment and remaining activation

[DEPLOYMENT.md](DEPLOYMENT.md) describes persistent database/uploads, HTTPS, operator setup and acceptance checks. Docker and CI files are included. **Paddle is deliberately left in manual mode.** Hosting, DNS, real email delivery from Gmail, mobile geolocation and physical printing still need checks in the actual customer environment. Test results and practical limits are in [TEST_NETICELERI.md](TEST_NETICELERI.md).
