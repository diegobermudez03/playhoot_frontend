import {
  adminBudgetControlsPath,
  adminBudgetCutoffPath,
  adminBudgetPath,
  adminBudgetReopenPath,
  adminCancelDeadTaskPath,
  adminDeadTasksPath,
  adminEmailModePath,
  adminEmailPath,
  adminMarketsPath,
  adminRetryDeadTaskPath,
  adminTextsPath,
  budgetStatusSchema,
  deadTasksResponseSchema,
  emailStatusSchema,
  marketsResponseSchema,
  outcomeResponseSchema,
  publishedTextResponseSchema,
  textCatalogResponseSchema,
  type BudgetControlsRequest,
  type BudgetCutoffRequest,
  type BudgetReopenRequest,
  type BudgetStatusResponse,
  type DeadTasksResponse,
  type EmailModeRequest,
  type EmailStatusResponse,
  type MarketsResponse,
  type PublishedTextResponse,
  type PublishTextRequest,
  type SetMarketRuleRequest,
  type TextCatalogResponse,
} from '@playhoot/protocol';

import type { HttpClient, HttpFailure } from './http';
import type { Result } from './result';

// The administrator's panels over `/admin/v1` (D-023). Every call here carries the admin-mode
// token, which lives only in memory; the account credential never reaches these addresses.
export interface AdminClient {
  deadTasks(): Promise<Result<DeadTasksResponse, HttpFailure>>;
  // The backend's outcome (`retried`, `cancelled`, `not_dead`...), as it wrote it.
  retryDeadTask(taskUUID: string): Promise<Result<string, HttpFailure>>;
  cancelDeadTask(taskUUID: string): Promise<Result<string, HttpFailure>>;
  budget(): Promise<Result<BudgetStatusResponse, HttpFailure>>;
  setControls(request: BudgetControlsRequest): Promise<Result<string, HttpFailure>>;
  cutoff(request: BudgetCutoffRequest): Promise<Result<string, HttpFailure>>;
  reopen(request: BudgetReopenRequest): Promise<Result<string, HttpFailure>>;
  email(): Promise<Result<EmailStatusResponse, HttpFailure>>;
  setEmailMode(request: EmailModeRequest): Promise<Result<string, HttpFailure>>;
  markets(): Promise<Result<MarketsResponse, HttpFailure>>;
  // The backend's outcome (`recorded`); `conditions_pending` and `invalid` come back as failures.
  setMarketRule(request: SetMarketRuleRequest): Promise<Result<string, HttpFailure>>;
  texts(): Promise<Result<TextCatalogResponse, HttpFailure>>;
  publishText(request: PublishTextRequest): Promise<Result<PublishedTextResponse, HttpFailure>>;
}

export function createAdminClient(http: HttpClient): AdminClient {
  const outcome = async (
    method: 'POST' | 'PUT',
    path: string,
    body: unknown,
  ): Promise<Result<string, HttpFailure>> => {
    const result = await http.request({ method, path, body, response: outcomeResponseSchema });
    return result.ok ? { ok: true, value: result.value.outcome } : result;
  };
  return {
    deadTasks: () =>
      http.request({ method: 'GET', path: adminDeadTasksPath, response: deadTasksResponseSchema }),
    retryDeadTask: (taskUUID) => outcome('POST', adminRetryDeadTaskPath(taskUUID), {}),
    cancelDeadTask: (taskUUID) => outcome('POST', adminCancelDeadTaskPath(taskUUID), {}),
    budget: () =>
      http.request({ method: 'GET', path: adminBudgetPath, response: budgetStatusSchema }),
    setControls: (request) => outcome('PUT', adminBudgetControlsPath, request),
    cutoff: (request) => outcome('POST', adminBudgetCutoffPath, request),
    reopen: (request) => outcome('POST', adminBudgetReopenPath, request),
    email: () => http.request({ method: 'GET', path: adminEmailPath, response: emailStatusSchema }),
    setEmailMode: (request) => outcome('PUT', adminEmailModePath, request),
    markets: () =>
      http.request({ method: 'GET', path: adminMarketsPath(), response: marketsResponseSchema }),
    setMarketRule: (request) => outcome('PUT', adminMarketsPath(), request),
    texts: () =>
      http.request({ method: 'GET', path: adminTextsPath, response: textCatalogResponseSchema }),
    publishText: (request) =>
      http.request({
        method: 'PUT',
        path: adminTextsPath,
        body: request,
        response: publishedTextResponseSchema,
      }),
  };
}
