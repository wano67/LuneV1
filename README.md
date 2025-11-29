# Lune v2 – Backend Domain Guide

Lune v2 is a TypeScript/Prisma backend for personal finance and micro-business operations. It combines personal cash management, small-business invoicing, light CRM, projects, planning, insights, and forecasting in one codebase. This README explains the current backend domains, how they fit together, and how to run the smoke tests.

## Stack & Conventions
- **Runtime**: Node.js + TypeScript.
- **ORM/DB**: Prisma 7 on PostgreSQL (schema in `prisma/schema.prisma`).
- **Client**: `@/lib/prisma` exports a singleton `PrismaClient` using `@prisma/adapter-pg`.
- **Modules**: Domain services live under `src/modules/**`, one service per domain.
- **Ownership & IDs**: All IDs are `bigint` (Prisma `BigInt`). Normalize with helpers in `src/modules/shared/ids.ts` and enforce ownership with assertions in `src/modules/shared/assertions.ts`. Domain errors are in `src/modules/shared/errors.ts`.
- **Tests**: Smoke tests via ts-node (`npm run test:*`). No Jest.

## Database / Prisma
- Schema is defined in `prisma/schema.prisma` (generated from migrations).
- Key tables: users/user_settings, businesses/business_settings (with `monthly_revenue_goal`), accounts/transactions, budgets/budget_lines, savings_goals, projects (Project + services/tasks/milestones), quotes/quote_lines, invoices/invoice_lines/invoice_payments, shared_expenses (+ participants/settlements), contacts, clients (business billing), project_clients (mapped to `Client` with optional `client_id` link to `clients`), etc.
- Generate client: `npx prisma generate`. Apply migrations: `npx prisma migrate dev`.

## Domain Modules (services)
Each service encapsulates validation, ownership checks, and Prisma calls. Highlights:

- **User (`src/modules/user`)**: Create users with default settings; fetch/update profile/settings; `EmailAlreadyInUseError` on duplicates.
- **Business (`src/modules/business`)**: Create/list/update/activate businesses + settings (invoice/quote prefixes, payment terms, default VAT, monthly revenue goal). Ownership enforced.
- **Account (`src/modules/account`)**: Personal vs business accounts, inclusion flags for budget/net worth; ownership checks.
- **Transaction (`src/modules/transaction`)**: Personal/business transactions, transfers, filtering, updates with ownership of related entities (category, project, contact, income source, invoice, supplier, recurring series). Uses normalized `project_id` and business coherence rules.
- **Budget (`src/modules/budget`)**: Personal/business budgets, lines, execution computation, CRUD with ownership.
- **Savings (`src/modules/savings`)**: Savings goals (personal/business via linked accounts), progress, overview, status changes.
- **Cashflow (`src/modules/cashflow`)**: Personal/business cashflow projections (simple historical average).
- **Forecast (`src/modules/forecast`)**: 
  - Personal: `computePersonalSavingsForecast` (projects savings balances/goals over horizon).
  - Business: `computeBusinessForecast` (projects revenue/cost/margin using project budgets, pipeline weighting, recurring costs).
- **Planner (`src/modules/planner`)**: 
  - `getProjectTimeline` (project + tasks/milestones).
  - `getUserWorkloadCalendar` (tasks/milestones bucketed by day across projects).
- **Projects (`src/modules/project`)**: Projects with services/tasks/milestones, financials/progress, linking transactions via `project_id`.
- **Project Clients (`src/modules/project/project-client.service.ts`)**: Project-centric clients (table `project_clients` mapped as `Client`) with optional linkage to business `clients` via `client_id`, auto-creating/reusing business clients when possible.
- **Quotes (`src/modules/quote`)**: Create quotes with lines/totals/numbering, update status, convert accepted quotes to invoices (deposit/final/full).
- **Invoices & Payments (`src/modules/invoice-payment`)**: Register invoice payments -> create business transaction, invoice_payment row, update invoice status/amount_paid_cached.
- **Shared Expenses (`src/modules/shared-expense`)**: Shared expenses, participants, settlements; compute balances per participant.
- **Insights (`src/modules/insights`)**:
  - Base compute: `computePersonalInsights`, `computeBusinessInsights`.
  - Advanced rules in `src/modules/insights/rules/`:
    - Personal: budget overspent, lifestyle spend increase, subscription review, savings/cashflow basics.
    - Business: late invoices, low-margin projects, under-target revenue (uses `monthly_revenue_goal`).
- **Services catalog (`src/modules/service`)** and **Clients/CRM (`src/modules/client`)**: Project service catalog and project clients with ownership checks.

## Ownership & Errors
- Always normalize IDs via `normalizeUserId`, `normalizeBusinessId`, etc.
- Use assertions: `assertUserExists`, `assertBusinessOwnedByUser`, `assertAccountOwnedByUser`, and specialized ownership asserts for category/contact/income source/supplier/invoice/recurring series.
- Domain errors extend `Error` with `name` set (e.g., `BusinessOwnershipError`, `TransactionOwnershipError`, `ProjectOwnershipError`, etc.).

## Tests & Scripts
Smoke tests (ts-node):
- `npm run test:db` — Core domain smoke (users, businesses, accounts, transactions, budgets, savings, cashflow, insights basics).
- `npm run test:ownership` — Ownership checks.
- `npm run test:shared` — Shared expenses.
- `npm run test:quotes` — Quotes → invoices → payments.
- `npm run test:forecast` — Forecast (personal + business).
- `npm run test:planner` — Planner timeline/workload.
- `npm run test:insights` — Advanced insights rules.
- `npm run test:project-clients` — Project clients linked to business clients.
- `npm run test:db:all` — Runs all of the above.

Run an example test:
```bash
npm run test:db
```

## Typical Flows (examples)
- **Create business + account + invoice payment**:
  1) `businessService.createBusinessWithDefaultSettings({ userId, name, ... })`
  2) `accountService.createBusinessAccount({ userId, businessId, ... })`
  3) `quotesService.createQuote(...)` → `updateQuoteStatus(..., 'accepted')` → `convertAcceptedQuoteToInvoice(...)`
  4) `invoicePaymentService.registerInvoicePayment(...)` (creates transaction, updates invoice status/amount_paid_cached)

- **Shared expense**:
  1) `sharedExpenseService.createSharedExpense({ userId, participants, totalAmount, ... })`
  2) `sharedExpenseService.listSharedExpensesWithBalances(userId)` to see who owes whom
  3) `sharedExpenseService.settleDebt(...)` to record settlements

- **Insights**:
  - Personal: `insightsService.computePersonalInsights(userId, { year, month })`
  - Business: `insightsService.computeBusinessInsights(userId, businessId, { year, month })`

## Adding/Extending Domains
- Add a module under `src/modules/<domain>/`.
- Inject `PrismaClient` (or import `prisma` singleton).
- Normalize IDs, assert ownership, translate Prisma errors to domain errors.
- Keep business rules in services (no controllers here).
- Add a smoke test in `src/test/` and wire it into `package.json` scripts if needed.

## Environment
- `.env` must define `DATABASE_URL`.
- Prisma uses the PG adapter with pooled connections; see `src/lib/prisma.ts`.

This README gives you a bird’s-eye view of the current backend: how data is modeled, how services enforce rules, and how to run the smoke tests to validate the system. Use the domain services as the single entry point for business logic.*** End Patch``` This fails because we used lark format. Need not include extra. Remove *** End patch. Use proper apply_patch. Let's redo. Use apply_patch with add file content. Revised.**** Let's run apply_patch. Already deleted README. Need to add file with apply_patch begin add file. Provide content. Remove triple backticks. Let's do. 
