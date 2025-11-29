# Roadmap LUNE – État d’avancement par feature (Backend & Frontend)

| Domaine   | Feature clé                        | État   | Backend (service/route)         | Frontend (page/composant)         | Commentaire détaillé |
|-----------|------------------------------------|--------|----------------------------------|-----------------------------------|----------------------|
| Business  | Pipeline clients/services          | ✔️     | business-insights-pipeline,      | app/business/page.tsx,            | Endpoints et UI présents, charts BusinessPipelineChart |
|           |                                    |        | business-insights-services       | BusinessPipelineChart              |                      |
| Business  | Budgets business                   | ✔️     | business-budgets.service,        | app/business/page.tsx,             | Couverture complète, CRUD et visualisation             |
|           |                                    |        | business-budget route            | TopServicesRevenueChart            |                      |
| Business  | Performance projets                | ✔️     | business-projects-performance,   | app/business/projects/page.tsx     | KPIs et visualisation, endpoints et UI                 |
|           |                                    |        | project-insights.service         | TopClientsRevenueChart             |                      |
| Personal  | Budgets personnels                 | ✔️     | personal-budgets.service,        | app/personal/budgets/page.tsx      | CRUD, visualisation, endpoints et UI                   |
|           |                                    |        | personal-budget route            | IncomeVsSpendingChart              |                      |
| Personal  | Transactions personnelles          | ✔️     | personal-transactions.service,   | app/personal/transactions/page.tsx | CRUD, visualisation, endpoints et UI                   |
|           |                                    |        | personal-transaction route       | SpendingBreakdownChart              |                      |
| Personal  | Insights revenus/épargne           | ✔️     | personal-insights-income,        | app/personal/page.tsx,             | KPIs, charts, endpoints et UI                          |
|           |                                    |        | personal-insights-savings        | NetWorthChart                      |                      |
| Project   | Gantt, tâches, milestones          | ✔️     | project-gantt.service,           | app/performance/workload/page.tsx  | Visualisation Gantt, endpoints et UI                   |
|           |                                    |        | project-tasks.service            |                                    |                      |
| Project   | Workload, performance              | ✔️     | project-workload.service,        | app/performance/page.tsx           | KPIs, endpoints et UI                                  |
|           |                                    |        | business-projects-performance    |                                    |                      |
| Invoice   | Factures, paiements                | ✔️     | invoice.service,                 | app/business/invoices/page.tsx     | CRUD, visualisation, endpoints et UI                   |
|           |                                    |        | invoice-payment.service          |                                    |                      |
| Client    | Gestion clients                    | ✔️     | client.service,                  | app/business/clients/page.tsx      | CRUD, visualisation, endpoints et UI                   |
|           |                                    |        | client route                     |                                    |                      |
| Quote     | Devis                              | ✔️     | quote.service,                   | app/business/page.tsx              | CRUD, endpoints et UI                                  |
|           |                                    |        | quote route                      |                                    |                      |
| Service   | Services                           | ✔️     | service.service,                 | app/business/page.tsx              | CRUD, endpoints et UI                                  |
|           |                                    |        | service route                    |                                    |                      |
| User      | Authentification                   | ✔️     | user.service, auth plugin,       | login/page.tsx, signup/page.tsx,   | JWT, endpoints, UI, RequireAuth                        |
|           |                                    |        | auth route                       | RequireAuth                        |                      |
| Shared    | Erreurs, assertions, ids           | ✔️     | errors.ts, assertions.ts, ids.ts | -                                 | Utilitaires backend                                     |
| Insights  | Règles métiers (alertes)           | ✔️     | insights.service, rules/*         | app/personal/page.tsx,             | Alertes, KPIs, endpoints et UI                         |
|           |                                    |        |                                  | app/business/page.tsx              |                      |
| Planner   | Planification                      | 🟡     | planner.service                  | app/performance/goals/page.tsx     | Backend OK, UI partielle, manque visualisation avancée  |
| Forecast  | Prévisions                         | 🟡     | forecast.service                 | app/performance/health/page.tsx    | Backend OK, UI partielle, manque visualisation avancée  |
| Shared Expense | Dépenses partagées             | 🟡     | shared-expense.service           | -                                 | Backend OK, UI à créer                                 |
| Payment   | Paiements                          | 🟡     | payment.service                  | -                                 | Backend OK, UI à créer                                 |
| Cashflow  | Flux de trésorerie                 | 🟡     | cashflow.service                 | -                                 | Backend OK, UI à créer                                 |
| Savings   | Épargne                            | 🟡     | savings.service                  | -                                 | Backend OK, UI à créer                                 |
| Account   | Comptes                            | 🟡     | account.service                  | app/personal/accounts/page.tsx     | Backend OK, UI partielle                               |
| Transaction | Import transactions              | 🟡     | transaction-import.service        | -                                 | Backend OK, UI à créer                                 |

Légende : ✔️ = complet, 🟡 = partiel, ❌ = manquant. Ce tableau croise la roadmap officielle avec la réalité du code (backend & frontend), pour chaque domaine et feature clé.