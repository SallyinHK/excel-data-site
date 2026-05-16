# Deploy Notes for Excel-Data-Site

This project is not a pure static website. It is a full-stack app:

- Frontend: React + Vite in `artifacts/roi-platform`
- Backend: Express API in `artifacts/api-server`
- Database: PostgreSQL through `DATABASE_URL`
- Optional Google Sheets sync: Replit connector-based code in `/api/sheets/*`

## What was cleaned

The original zip included Replit-only and local folders such as `.local`, `.git`, and built `dist` outputs. Those should not be pushed to GitHub or deployed.

## Recommended deploy path

Use a platform that can run a Node/Express web service and a Postgres database, such as Render, Railway, Fly.io, or Replit Deployments.

This folder includes a basic `render.yaml` and a production static-file setup in `artifacts/api-server/src/app.ts`, so the Express server can serve both:

- `/api/*` backend routes
- the built React frontend

## Build and start commands

Build command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm run deploy:build
```

Start command:

```bash
pnpm run start
```

Required environment variables:

```bash
NODE_ENV=production
DATABASE_URL=<your Postgres connection string>
```

The frontend build also requires `PORT` and `BASE_PATH`, so `deploy:build` sets dummy build-time values:

```bash
PORT=19154 BASE_PATH=/
```

## Database schema

Before the app can read/write data, the Postgres tables need to be created. After the database is connected, run:

```bash
pnpm --filter @workspace/db run push
```

On Render free web services, pre-deploy commands may not be available, so you may need to run this from a local terminal using the production `DATABASE_URL`, or use a one-off shell if your hosting plan supports it.

## Important caveat about Google Sheets

The current Google Sheets integration uses `@replit/connectors-sdk`. Outside Replit, the `/api/sheets/export` and `/api/sheets/import` routes may not work until this is replaced with normal Google Sheets API credentials. The rest of the app can still be deployed if the database is set up.

## If deploying only frontend to Vercel or Netlify

Use this only for a static demo. The API-backed pages will fail unless the backend is deployed somewhere else or the API calls are replaced with mock/static data.

Frontend-only build command:

```bash
corepack enable && pnpm install --frozen-lockfile && PORT=19154 BASE_PATH=/ pnpm --filter @workspace/roi-platform run build
```

Output/publish directory:

```bash
artifacts/roi-platform/dist/public
```
