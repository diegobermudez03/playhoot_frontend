import { z } from 'zod';

// The administrator's panels (backend `api/queues`, `api/budget`, `api/notifications`). Every
// address under `/admin/v1` is sent with the admin-mode token, never with the account credential.
//
// Backend values — queue names, task types, budget categories, cap scopes, windows, ladder levels,
// delivery states, providers — are never closed lists here: a value this build does not know is
// still shown as the backend wrote it.

// --- Dead letter queues (V-05: the newest 100 dead tasks per domain queue) ---

export const adminDeadTasksPath = '/admin/v1/queues/dead';
export const adminRetryDeadTaskPath = (taskUUID: string) =>
  `${adminDeadTasksPath}/${encodeURIComponent(taskUUID)}/retry`;
export const adminCancelDeadTaskPath = (taskUUID: string) =>
  `${adminDeadTasksPath}/${encodeURIComponent(taskUUID)}/cancel`;

// A retry or cancel of a task that is no longer dead; it changed nothing and is not a failure.
export const deadTaskNotDeadOutcome = 'not_dead';
// 404: the task is unknown.
export const taskNotFoundCode = 'task_not_found';

export const deadTaskSchema = z.object({
  // The domain whose queue the task is on.
  domain: z.string(),
  task_uuid: z.string().min(1),
  type: z.string(),
  attempts: z.number().int().nonnegative(),
  last_error: z.string(),
  // How many times an administrator already put this task back.
  admin_retries: z.number().int().nonnegative(),
  created_at: z.string(),
  died_at: z.string(),
});

export const deadTasksResponseSchema = z.object({
  tasks: z.array(deadTaskSchema),
  // Domains whose queue could not be read; the others are still listed.
  unavailable: z.array(z.string()),
});

export const outcomeResponseSchema = z.object({ outcome: z.string() });

export type DeadTaskResponse = z.infer<typeof deadTaskSchema>;
export type DeadTasksResponse = z.infer<typeof deadTasksResponseSchema>;

// --- Budget (P32§4,§7; D-012, D-017) ---

export const adminBudgetPath = '/admin/v1/budget';
export const adminBudgetControlsPath = '/admin/v1/budget/controls';
export const adminBudgetCutoffPath = '/admin/v1/budget/cutoff';
export const adminBudgetReopenPath = '/admin/v1/budget/reopen';

// The ladder levels the backend uses today, weakest restriction first. Shown in this order; a
// level this build does not know is still shown.
export const budgetLadderLevels = ['normal', 'restricted', 'paused', 'shutdown'] as const;

// The windows a cap and its consumption are measured over (UTC calendar).
export const budgetWindows = ['hour', 'day', 'month'] as const;

export const budgetCapSchema = z.object({
  // `global`, or a category name.
  scope: z.string(),
  window: z.string(),
  usd_limit: z.number(),
  max_concurrency: z.number().int().nonnegative().optional(),
  max_volume: z.number().int().nonnegative().optional(),
});

export const budgetRateSchema = z.object({
  category: z.string(),
  service: z.string(),
  unit: z.string(),
  usd_per_unit: z.number(),
});

export const budgetUsageSchema = z.object({
  scope: z.string(),
  window: z.string(),
  measured_usd: z.number(),
  estimated_usd: z.number(),
  reserved_usd: z.number(),
  // Null where this scope and window have no cap: that blocks the category, it is not freedom.
  limit_usd: z.number().nullable(),
});

export const budgetStatusSchema = z.object({
  ladder: z.object({
    level: z.string(),
    paused_categories: z.array(z.string()),
    // Categories a gradual reopening still holds closed.
    reopen_closed: z.array(z.string()),
    reason: z.string(),
    actor: z.string(),
    since: z.string().optional(),
  }),
  caps: z.array(budgetCapSchema),
  rates: z.array(budgetRateSchema),
  usage: z.array(budgetUsageSchema),
  active_reservations: z.number().int().nonnegative(),
  last_hour_usd: z.number(),
  // Projected hours until the month cap is reached at the current pace; null when not projectable.
  hours_to_month_cap: z.number().nullable(),
  // Categories spending without a price: their admission is blocked until one is set.
  rate_missing: z.array(z.string()),
});

export type BudgetCap = z.infer<typeof budgetCapSchema>;
export type BudgetRate = z.infer<typeof budgetRateSchema>;
export type BudgetUsage = z.infer<typeof budgetUsageSchema>;
export type BudgetStatusResponse = z.infer<typeof budgetStatusSchema>;

// PUT /admin/v1/budget/controls: appends caps and rates. A reason and at least one cap or rate
// are required; `effective_at` defaults to now.
export interface BudgetControlsRequest {
  caps?: BudgetCap[];
  rates?: BudgetRate[];
  effective_at?: string;
  reason: string;
  step_up_proof: string;
}

// POST /admin/v1/budget/cutoff: immediate manual shutdown. `shut_down` or `already_shut_down`.
export interface BudgetCutoffRequest {
  reason: string;
  step_up_proof: string;
}

// POST /admin/v1/budget/reopen: one step of the gradual reopening (P32§7). From shutdown the
// first call names no category and leaves everything closed at `restricted`; each later call
// opens the categories it names. `not_shut_down` / `already_open` (409) say the step was not the
// one the backend expected.
export interface BudgetReopenRequest {
  categories?: string[];
  reason: string;
  step_up_proof: string;
}

export const budgetNotShutDownCode = 'not_shut_down';
export const budgetAlreadyOpenCode = 'already_open';
export const budgetInvalidCode = 'invalid';

// --- Outbound email (P31§2,§5) ---

export const adminEmailPath = '/admin/v1/email';
export const adminEmailModePath = '/admin/v1/email/mode';

// The modes the backend accepts (P31§2). Switchable without deploying.
export const emailModes = ['automatic', 'resend-only', 'ses-only'] as const;
export type EmailMode = (typeof emailModes)[number];

// Resend's joint free quota, which `automatic` and `resend-only` spend before SES is used.
export const resendDailyQuota = 100;
export const resendMonthlyQuota = 3000;

// The delivery states the backend records, in lifecycle order.
export const emailDeliveryStates = ['pending', 'sent', 'rejected', 'failed'] as const;

export const emailStatusSchema = z.object({
  mode: z.string(),
  mode_since: z.string(),
  mode_reason: z.string(),
  usage: z
    .array(
      z.object({
        provider: z.string(),
        today: z.number().int().nonnegative(),
        month: z.number().int().nonnegative(),
        estimated_usd: z.number(),
      }),
    )
    .nullish(),
  // State -> count over the 30-day record window. Bodies are never stored (P31§5).
  deliveries_30d: z.record(z.string(), z.number().int().nonnegative()),
});

export type EmailStatusResponse = z.infer<typeof emailStatusSchema>;

// PUT /admin/v1/email/mode: a reason is required; `invalid` (400) refuses anything else.
export interface EmailModeRequest {
  mode: string;
  reason: string;
}
