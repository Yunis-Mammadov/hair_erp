# z-Index Starter

Complete source release: **2026-11-20 — seven-day trials**. React 19, Express 5, Prisma 6.19.3, PostgreSQL 18, Node 24. Global Starter: **USD 19.99 monthly / USD 199.99 yearly**. Azerbaijan prices are unchanged. `shared/pricing.json` is the shared source of subscription prices; workspace operating currency is independent.

## Upgrade an existing installation

Follow [BASLA_BURADAN.md](BASLA_BURADAN.md). Stop app and worker processes, back up the database **and uploads**, preserve private `.env` files and images, install locked dependencies, run `prisma migrate deploy`, then generate Prisma Client. This release adds migration `202611200001_seven_day_trial` on top of the previous releases. Never use `migrate reset` or `db push` on business data.

## Included in this release

- Public landing, Starter pricing, four-language signup and email verification before company creation.
- A card-free, exactly 168-hour Starter trial with independent company records, chosen operating currency/timezone, private owner PIN and up to 3 active users.
- Server-enforced expiry, remaining-time banner, restricted renewal access and upgrade of the same company without resetting its records.
- SMTP verification links expire after one hour. Only token hashes are stored. Signup throttling and one-trial-per-verified-email protection are included.
- Local console delivery is explicitly development-only. Production signup is opt-in and requires real SMTP configuration. Paddle remains manual/disabled until configured and tested.

- Customer contact edit with stale-record protection; invoice snapshots and opening balances remain historical.
- Admin purchase correction/void with a mandatory reason, stock reconciliation, revision history and repeat-request protection.
- Operator company search/pagination, password and worker PIN recovery, manual subscription extension, activation/deactivation and audit history. Operator secret stays server-side and in browser memory only.
- Support email draft composer for Gmail or the user's mail app. Customers review and send the draft themselves; no SMTP credentials are required for this support workflow.
- Private company logo on the dashboard and in PDF invoices.
- Monthly net sales: sales posted this month less returns posted this month, in the company's timezone. Payments and customer cash refunds do not subtract from sales again.
- Previous audited accounting, tenant isolation, Excel/CSV opening-balance import, four languages, purchasing workflow, invoice detail redesign and Group 7 features.

## New local installation

Use an empty dedicated PostgreSQL database. Copy `server/.env.example` to `server/.env`; configure the database and independently generated server secrets. From `server`, run `npm ci`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run dev`. From `client`, run `npm ci` and `npm run dev`. Open `/operator/companies` to provision companies using your private operator secret; public trial registration is opt-in, and shared default production PINs are refused. See the trial configuration below.

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

## Trial configuration

Default: `TRIAL_SIGNUP_ENABLED=false`. Existing company login continues to work.
For local testing in `server/.env`: `NODE_ENV=development`, `TRIAL_SIGNUP_ENABLED=true`, `TRIAL_EMAIL_MODE=console`, `APP_URL=http://localhost:5173`, `BILLING_PROVIDER=manual`. Open `/trial`. The backend prints a **local-only, not-sent verification link** after an eligible request. Open that link and complete setup in the browser. No real email is sent in console mode.

Production: set `TRIAL_EMAIL_MODE=smtp` and configure `SMTP_HOST`, `SMTP_PORT` (587 or 465), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` and the public HTTPS `APP_URL`. Use a real verified sender. Keep secrets server-side. Production refuses console delivery. Test a real inbox and spam folder on the deployed site before inviting customers.

The free trial begins only on successful activation, not when the email is requested. The verified real email is separate from the company's `<code>@zindex.com` login identifier. The email remains claimed after expiry or conversion. A paid subscription begins when confirmed; unused free days are not stacked onto that paid period. Before Paddle is enabled, the private operator subscription action can grant manual paid access without fabricating a financial payment record. Changing only `endsAt` directly does not bypass the trial deadline.

Native integration checks require a dedicated local `NATIVE_DATABASE_URL` ending in `_test`, PostgreSQL 18 tools, and `npm --prefix client run build` first; then run `npm --prefix server run test:native`. They create and drop isolated test databases. CI builds the frontend before the native production-layout smoke test.
