# Emergency Service 24/7 — clean web application

This is the new ES 24/7 web application repository. It is intentionally separate from the Android application repository `es247-andriod` and from the Global English Academy Online school platform.

## Implemented foundation

- Express API, PostgreSQL schema and Railway Docker deployment.
- Master administrator, company controller and client roles.
- Password hashing, HTTP-only signed session cookie, rate-limited login, forced temporary-password change and password-reset tokens delivered through Resend when configured.
- Master administrator company directory with registered company details and aggregate client totals only.
- Company registration fields: Registered Company Name, CIPC Number, PSIRA Number, optional B-BBEE, Contact Number, Contact Email, Covering Areas, Tax Number and optional VAT Number.
- Company controller workspace with company-scoped client and incident records, a map of incidents with coordinates, and timestamped incident events.
- OB number required before controller status actions; workflow supports Acknowledge, Acknowledge & No Responder Available, Controller Responding, Response Dispatched, Response On Site and Incident Resolved.
- Master-admin client and controller creation; client accounts must change temporary passwords.
- Client panic API and bearer-token login contract for the separate Android app.
- Company archive/restore, retaining associated history in the database.

## Important current limitations

This is an initial working foundation, not a declared production-ready emergency dispatch service. Before real-world use, complete live database and browser tests, security review, backup/restore drills, Android-to-production panic tests, push-notification/dispatch integration and APK download verification. No incident notification or responder dispatch provider is configured by default.

## Required Railway variables

- `DATABASE_URL`: attach a Railway PostgreSQL service.
- `JWT_SECRET`: unique random value of at least 32 characters.
- `INITIAL_ADMIN_EMAIL`: first master administrator email.
- `INITIAL_ADMIN_PASSWORD`: strong password of at least 12 characters. The first admin is created only when the database has no users. Remove this variable after successful bootstrap.
- `NODE_ENV=production`
- `APP_BASE_URL`: deployed HTTPS application URL.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: required for password-reset email delivery.

Never commit `.env` or share passwords in chat. Do not use a shared/default JWT secret or admin password.

## Deploy

1. Create a new Railway project for ES 24/7 and attach PostgreSQL.
2. Deploy this repository from the `main` branch using the included Dockerfile.
3. Add the required variables in Railway; do not place secrets in source code.
4. Verify `/health`, sign-in, password changes, master/company isolation, incident updates, reset emails and database recovery before announcing production readiness.

## Local setup

Use Node.js 20+ and PostgreSQL. Set the variables above, run `npm install`, then `npm start`. Run `npm run check` for JavaScript syntax checks.

See [MOBILE_API.md](MOBILE_API.md) for the Android API contract.
