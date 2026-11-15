> Son yeniləmə: **audit + 7-ci qrup**. [Quraşdırma və yeni funksiyalar](GROUP7-RELEASE.md).

# z-Index Starter

Multi-tenant inventory, sales, customers and receivables. React 19, Express 5, Prisma 6.19.3 and PostgreSQL. Global Starter pricing is USD 14.99 monthly / USD 149.99 annually.

## Existing installation

See [final audit fixes](AUDIT-FIXES.md) and the [Windows upgrade guide](docs/audit-fixes/QURASDIRMA.md). The upgrade has no new database migration. Preserve the existing environment and uploads.

## New local development installation

1. Use Node 24.15+ (24.x) and a running PostgreSQL server. Create an empty dedicated database.
2. Copy `server/.env.example` to `server/.env`; set the database URL and a cryptographically random JWT secret of at least 32 bytes. Do not commit real credentials.
3. In `server`, run `npm ci`, `npx prisma migrate deploy`, then `npx prisma generate`.
4. Provision company/admin credentials using the existing `company:create` operator command. No public self-registration or default production PIN is provided.
5. In `client`, run `npm ci`. The default `/api` URL proxies to local port 7079 in development; `client/.env.example` shows the override.
6. Run `npm run dev` in each folder. Sign in and confirm the operating currency before the first financial transaction.

## Checks

```sh
node server/scripts/check-repository.cjs
npm --prefix server test
npm --prefix client test
npm --prefix client run lint -- --max-warnings=0
npm --prefix client run build
```

Native database checks use a dedicated local database ending in `_test` via `NATIVE_DATABASE_URL`. Backup tests also require PostgreSQL 18 `pg_dump` and `pg_restore`. Do not point test variables at business databases.

## Production

See [deployment](docs/audit-fixes/DEPLOY.md). Automated tests and container smoke checks are defined in `.github/workflows/ci.yml`. A local passing test suite does not substitute for the target hosting, browser, printer and payment-provider acceptance tests.
