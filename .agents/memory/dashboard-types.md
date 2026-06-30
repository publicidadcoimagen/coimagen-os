---
name: DashboardSummary and ProspectStatus fields
description: Available fields on DashboardSummary and valid ProspectStatus values
---

**DashboardSummary fields:** `totalClients, activeClients, suspendedClients, activeProjects, openTasks, overdueTasks, completedProjectsThisMonth, totalAgents, activeClientsThisMonth, pendingApprovals, mrr, arr, totalCostsThisMonth, marginThisMonth, overdueInvoices, upcomingPayments`. There is NO `activeAgents` — use `totalAgents`.

**ProspectStatus const enum values:** `lead | qualified | disqualified | converted`. There is NO `active`, `diagnosed`, `proposal_sent`, or `closed_won`.

**Why:** These come from the OpenAPI spec and are generated. If you filter prospects by status, you must use the valid enum values from `ProspectStatus` const.
