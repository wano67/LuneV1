# Synthèse des modules backend par domaine

| Domaine      | Modules/Services principaux                                                                 |
|-------------|---------------------------------------------------------------------------------------------|
| **Business** | business.service, business-insights-services.service, business-insights-pipeline.service,   |
|             | business-insights-clients.service, business-budgets.service, business-projects-performance, |
|             | business-transactions.service                                                               |
| **Personal** | personal-insights-income.service, personal-insights-savings.service, personal-transactions, |
|             | personal-budgets.service, personal-insights.service, personal-insights-seasonality.service, |
|             | personal-insights-score.service, personal-insights-spending.service                         |
| **Project**  | project.service, project-gantt.service, project-tasks.service, project-client.service,      |
|             | project-insights.service, project-milestone.service, project-workload.service,              |
|             | project-task.service                                                                        |
| **Client**   | client.service                                                                             |
| **Invoice**  | invoice.service, invoice-payment.service                                                   |
| **Quote**    | quote.service                                                                              |
| **Service**  | service.service                                                                            |
| **Budget**   | budget.service                                                                             |
| **Account**  | account.service                                                                            |
| **Cashflow** | cashflow.service                                                                           |
| **Savings**  | savings.service                                                                            |
| **Transaction** | transaction.service, transaction-import.service                                          |
| **Payment**  | payment.service                                                                            |
| **Planner**  | planner.service                                                                            |
| **Forecast** | forecast.service                                                                           |
| **Shared Expense** | shared-expense.service                                                               |
| **User**     | user.service                                                                               |
| **Insights** | insights.service, rules/* (personal-subscription-review, business-low-margin-project,       |
|             | business-late-invoices, personal-lifestyle-spend-increase, personal-budget-overspent,       |
|             | business-under-target-revenue)                                                              |
| **Shared**   | assertions.ts, errors.ts, ids.ts                                                           |

Ce tableau permet de visualiser la couverture métier réelle du backend, facilitant le mapping roadmap et la priorisation des développements.