# Enterprise ROI Platform

Enterprise ROI Platform is a web-based ROI evaluation and decision-support platform for enterprise investment projects.

It helps users structure project assumptions, calculate ROI-related metrics, review project-level results, generate report-style summaries, and run sensitivity analysis before investment approval.

The platform is designed as an MVP demo for enterprise capital allocation use cases, including product launches, infrastructure investments, IT transformation projects, and regional expansion decisions.

## Live Demo

Hosted demo:

https://excel-data-site.onrender.com

Note: the hosted service may take some time to wake up if it has been inactive, because the current deployment uses Render's free web service.

## Project Overview

This platform supports an end-to-end ROI review workflow.

1. Review portfolio-level performance on the Dashboard
2. Open project-level ROI results in Projects
3. Check metric calculation logic for NPV, IRR, Payback, ROI and PI
4. Generate an ROI report view for project discussion
5. Run sensitivity analysis in Simulator
6. Review formula and regional assumptions in Governance pages

## Key Features

### 1. Executive Dashboard

The Dashboard provides a portfolio-level view of all investment projects.

It includes:

- Total number of projects
- Approved, in-review and draft project count
- Average NPV
- Total investment size
- Project distribution by region
- Status distribution
- Key output metrics by project

This gives users a quick overview of the current investment portfolio.

### 2. Projects Registry

The Projects page lists all investment projects in a structured registry.

Users can review:

- Project ID
- Project name
- Region
- Status
- Investment size
- Created date

The registry helps users quickly find and open project-level details.

### 3. Project Detail and ROI Metrics

Each project detail page shows core ROI evaluation metrics:

- NPV
- IRR
- Payback Period
- ROI
- Profitability Index
- Total Revenue
- Total Cost
- Total CapEx

These metrics help users evaluate whether a project creates financial value.

### 4. Calculation Logic Explanation

Each key metric includes an information icon.

Users can click the icon to review:

- Formula logic
- Current result
- Key inputs
- Business interpretation

This feature improves calculation transparency and reduces black-box concerns.

### 5. ROI Report View

Each project has an ROI Report page that summarizes:

- Project information
- Core ROI metrics
- Annual free cash flow
- Cumulative cash flow
- Yearly cash flow table
- Total revenue, total cost and total free cash flow

The report page is designed for project review, meeting discussion, and future PDF export.

### 6. ROI Simulator

The Simulator allows users to load a baseline project and test assumption changes.

Users can adjust:

- Sales Volume
- Net Price
- COGS
- OpEx

The system updates NPV, IRR, ROI and Payback results in real time.

The Simulator also includes a P&L-style output:

- Revenue
- COGS
- Gross Profit
- OpEx
- EBITDA
- Tax Expense
- NOPAT
- CapEx
- Free Cash Flow
- Contribution Margin

This helps users understand how changes in assumptions affect project returns.

### 7. Formula Governance

The Formula Governance page manages financial assumptions such as:

- WACC
- Discount Rate
- Formula version
- Governance status

This supports a controlled and consistent ROI calculation process.

### 8. Regional Parameters

The Regional Parameters page manages region-level assumptions, including:

- Tax rate
- Currency
- FX rate to USD
- Effective date

These settings support regional investment comparison and future scenario calculation.

### 9. Guided Demo

The platform includes a non-blocking guided demo card.

The guide helps first-time users follow the recommended demo path:

    Dashboard -> Sample Project -> ROI Report -> Simulator

The guide is shown as a floating card so users can still see and interact with the platform while following the steps.

## Demo Data

The current MVP includes seeded demo projects:

- NextGen Fiber Optics — APAC Rollout
- Smart Grid Modernization — EU Phase 2
- Cloud ERP Migration — NA
- Autonomous Logistics Platform — LATAM
- Renewable Energy Storage — MEA
- Digital Health Platform — NA

These demo projects are used to showcase dashboard analytics, project-level ROI results, reports, and simulator workflows.

## Tech Stack

- Frontend: React, Vite, TypeScript
- UI: Tailwind CSS, shadcn-style components
- Backend: Node.js, Express
- Database: Supabase PostgreSQL
- ORM: Drizzle ORM
- Package Manager: pnpm
- Deployment: Render
- Source Control: GitHub

## Repository Structure

    .
    ├── artifacts/
    │   ├── roi-platform/        # Frontend application
    │   └── api-server/          # Backend API server
    ├── lib/
    │   └── db/                  # Database schema and DB client
    ├── scripts/                 # Utility scripts, including demo data seed script
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── render.yaml
    └── README.md

## Local Development

### 1. Install dependencies

    corepack enable
    pnpm install --frozen-lockfile

### 2. Configure environment variables

Export your Supabase PostgreSQL connection string:

    export DATABASE_URL='your-supabase-postgres-connection-string'

Do not commit database passwords or private keys to GitHub.

### 3. Seed demo data

    pnpm --filter @workspace/scripts exec tsx src/seed-roi-demo-data.ts

### 4. Build frontend

    PORT=19154 BASE_PATH=/ pnpm --filter @workspace/roi-platform run build

### 5. Build backend

    pnpm --filter @workspace/api-server run build

### 6. Copy frontend build into backend artifact folder

    mkdir -p artifacts/api-server/artifacts/roi-platform/dist
    rm -rf artifacts/api-server/artifacts/roi-platform/dist/public
    cp -R artifacts/roi-platform/dist/public artifacts/api-server/artifacts/roi-platform/dist/public

### 7. Start local preview

    NODE_ENV=production PORT=10000 node --enable-source-maps artifacts/api-server/dist/index.mjs

Then open:

    http://localhost:10000

## Deployment on Render

Recommended Render build command:

    corepack enable && pnpm install --frozen-lockfile && pnpm run deploy:build && mkdir -p artifacts/api-server/artifacts/roi-platform/dist && rm -rf artifacts/api-server/artifacts/roi-platform/dist/public && cp -R artifacts/roi-platform/dist/public artifacts/api-server/artifacts/roi-platform/dist/public

Recommended Render start command:

    pnpm run start

Required Render environment variables:

    DATABASE_URL=your-supabase-postgres-connection-string
    NODE_ENV=production
    NODE_VERSION=22.22.0

## Google Sheets Sync Status

The Dashboard keeps the Import and Export entry points for Google Sheets sync.

Current status:

- The UI entry is retained for demo continuity
- The original Replit connector does not work directly after migration to Render
- A future integration can be implemented through Google Apps Script bridge or Google Sheets API

Planned workflow:

    Google Sheet Input -> Import to Supabase -> ROI Calculation -> Export Output to Google Sheet

## Current MVP Scope

Completed:

- Render + Supabase deployment structure
- Demo data seeding
- Dashboard portfolio overview
- Projects Registry
- Project Detail ROI results
- Metric calculation logic explanation
- ROI Report page
- Project-based Simulator baseline loading
- Sensitivity analysis
- Formula Governance
- Regional Parameters
- Guided demo card

Pending or future improvements:

- Fully working Google Sheet live Import / Export
- Excel / CSV file upload and recognition
- Role-based access control
- Approval workflow
- More complete audit trail
- PDF and PPT export
- Integration with ERP, CRM or finance systems

## Demo Flow

Recommended presentation order:

1. Open Dashboard to review portfolio performance
2. Go to Projects and open Digital Health Platform — NA
3. Review NPV, IRR, Payback, ROI and PI
4. Click the info icon to explain calculation logic
5. Open ROI Report to show a meeting-ready summary
6. Go to Simulator and load a baseline project
7. Adjust Sales Volume, Net Price, COGS or OpEx
8. Review the impact on NPV, IRR, ROI and Payback
9. Open Formulas and Regions to explain governance assumptions

## Security Notes

Do not commit:

- .env files
- Supabase database passwords
- Google service account JSON files
- Private keys
- API tokens

If a database password has been exposed, reset it in Supabase and update the Render environment variable.

## License

This project is developed as an MVP demo for academic and presentation purposes.
