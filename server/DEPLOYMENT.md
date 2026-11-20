# Production deployment checklist

This is preparation for deployment. No remote server, DNS zone, production database, email account or Paddle account was changed by creating this release.

1. Keep `BILLING_PROVIDER=manual`. Existing Paddle code stays disabled until the owner explicitly configures and verifies it later.
2. Provision a Linux host with Docker Compose. Set DNS for `z-index.online` to that host; ensure ports 80/443 are reachable. Neither PostgreSQL nor the application port needs a public host port.
3. Create `deploy/.env` privately with `APP_DOMAIN=z-index.online` and a new URL-safe random `POSTGRES_PASSWORD` (hex is suitable). Do not commit it. The database credentials and data on the old Windows installation are separate from these new production volumes.
4. Create private `server/.env` from the example. Set independent random `JWT_SECRET` and `PLATFORM_OWNER_SECRET` of at least 32 bytes. Use `APP_URL=https://z-index.online`, `SUPPORT_EMAIL=zindex.software@gmail.com`, `PRIVACY_EMAIL=zindex.software@gmail.com`, `SERVICE_OPERATOR_NAME=z-Index`, `BILLING_PROVIDER=manual`. Configure the actual operator name, contact, hosting region and retention policy before publishing the legal pages. Compose overrides `DATABASE_URL`, `HOST`, `NODE_ENV`, `UPLOADS_DIR` and proxy settings for its private services.
5. From the repository root, run `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build`. This creates a new production database, applies migrations through a dedicated container, persists uploaded images and puts Caddy in front of the app with HTTPS. This command does **not** copy your Windows business data. If migrating existing data, perform a separate backup/restore and reconcile counts and balances before opening access.
6. Check `/health`, `/ready`, `/login`, `/support` and `/operator/companies` over the real HTTPS domain. Unauthenticated API and private-image requests must fail. Never share the operator secret with customer companies.
7. Create a dedicated pilot company in the operator UI; choose its currency, individual worker PINs and expiry. Confirm cross-company isolation, sales, partial payment, return, cash refund, purchase edit/void, opening-debt import, dashboard net totals, company logo, PDF and actual printer output.
8. Confirm Gmail draft recipient and body and manually send a pilot support message. The app prepares a draft; it cannot confirm Gmail delivery. Optional automated debt reminders are a separate SMTP feature and remain disabled unless explicitly configured with consent.
9. Schedule off-host backups of **both** database and uploads. The bundled backup command requires stopping all application/worker writers and `--offline`. Rehearse a restore to a new database and a new uploads directory; never restore over the live database.
10. Run the repository index guard before pushing. Old database dumps previously committed to Git remain in remote history until a separate reviewed history cleanup. Do not use a blind force push.

The included CI workflow builds/runs the actual production container when pushed to GitHub. This authoring environment verified a matching production filesystem layout and HTTP smoke checks; it did not have a Docker daemon or control of the public domain. Treat a green GitHub container check and the real-domain pilot above as release gates.

## Public trial rollout

Keep `BILLING_PROVIDER=manual` until Paddle onboarding and sandbox/live acceptance are complete. In production `server/.env`, enable `TRIAL_SIGNUP_ENABLED=true`, `TRIAL_EMAIL_MODE=smtp`; supply real SMTP host, port 587/465, username, password and verified sender (`SMTP_FROM`). Use `APP_URL=https://z-index.online`. Compose reads these from the private server env file. `REMINDERS_ENABLED` is independent and can stay false.

Verify `/`, `/trial`, `/trial/activate`, `/api/trial/config`, `/terms`, `/privacy` and `/refunds`. Request an email to a real inbox; follow the delivered HTTPS link, choose workspace settings and confirm company login plus PIN. Verify the reverse proxy overwrites forwarded client addresses; the application uses its configured proxy hop count for request limits. SMTP delivery, DNS/SPF/DKIM configuration and real-browser acceptance are deployment checks, not simulated test results.

The public trial is an independent empty Global Starter workspace. It does not import the operator's business records or alter existing subscriptions. Records are retained at expiry; the same workspace is converted on verified payment or the explicit manual operator subscription action. No payment is taken for signup. One verified email can claim one trial; this does not establish unique personal identity across different email addresses.
