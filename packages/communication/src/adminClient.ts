import {
  adminBudgetControlsPath,
  adminBudgetCutoffPath,
  adminBudgetPath,
  adminBudgetReopenPath,
  adminCancelDeadTaskPath,
  adminDeadTasksPath,
  adminEmailModePath,
  adminEmailPath,
  adminRetryDeadTaskPath,
  budgetStatusSchema,
  deadTasksResponseSchema,
  emailStatusSchema,
  outcomeResponseSchema,
  type BudgetControlsRequest,
  type BudgetCutoffRequest,
  type BudgetReopenRequest,
  type BudgetStatusResponse,
  type DeadTasksResponse,
  type EmailModeRequest,
  type EmailStatusResponse,
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
  };
}
