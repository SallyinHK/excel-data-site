# Enterprise ROI Automation Platform

A full-stack capital allocation and investment ROI platform that automates NPV/IRR/Payback calculations, manages multi-region projects, enforces formula governance (admin-locked WACC), and provides executive portfolio dashboards with full audit trails.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, paths `/api/*`)
- Frontend: React + Vite (port 19154, base path `/`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Charts: Recharts

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/db/src/schema/` — Drizzle schema (projects, financials, governance)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/calculations.ts` — NPV/IRR/Payback engine (DCF + Newton-Raphson)
- `artifacts/roi-platform/src/pages/` — React pages (dashboard, projects, admin)

## Architecture decisions

- **Contract-first**: OpenAPI spec → Orval codegen → typed hooks and Zod validators. Never write fetch calls by hand.
- **Numeric storage**: All financial values stored as `numeric` strings in Postgres (Drizzle `decimal`), parsed to `number` before returning from API.
- **Governance lock**: `formula_definitions.locked` prevents WACC/discount rate edits without admin unlock. Enforced at route level.
- **Audit trail**: Every project status change, input save, and calculation is logged to `audit_log` table with old/new values.
- **Calculation engine**: Standard DCF with NOPAT = EBITDA × (1 - taxRate), Free Cash Flow = NOPAT - CapEx. IRR via Newton-Raphson iteration. Payback from cumulative FCF zero-crossing.

## Product

- **Executive Dashboard**: KPI cards (total projects, approved, avg NPV, total investment), regional bar chart, status donut, top-10 NPV table
- **Projects Registry**: Searchable/filterable list of all capital projects with status badges
- **Project Detail**: Scenario management (create/duplicate), editable 5-year financial inputs table, one-click recalculation, NPV/IRR/Payback/ROI cards, cash flow charts, scenario comparison table, audit log
- **Formula Governance**: WACC + discount rate display/edit (admin lock/unlock), version history, parameter tiles
- **Regional Parameters**: Per-region tax rate + currency + FX rate, inline editing, add new regions

## User preferences

- Bloomberg-terminal inspired dark sidebar, high-contrast UI, primary blue `hsl(221 83% 53%)`
- Dense information display with monospace fonts for financial figures

## Gotchas

- `roiPercent` is stored as a raw percentage (e.g. 82.61 = 82.61%), NOT as a decimal. Do not multiply by 100 for display.
- `irr` is stored as a decimal fraction (e.g. 0.4353 = 43.53%). Use `fmtPct` or multiply by 100 for display.
- After adding new schema to `lib/db`, always run `pnpm run typecheck:libs` to rebuild declarations before typechecking leaf packages.
- The `@workspace/db` barrel export must be updated in `lib/db/src/schema/index.ts` when adding new tables.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
