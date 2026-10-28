import { z } from 'zod';

// GET /v1/identity/operations (backend `api/identity/list_operations.go`, IDENTITY-ADR-0003): every
// operation with the minimum authentication level it requires. Public and cacheable; the same
// catalog the backend authorizes with. The frontend uses it to know where to send a person before
// they choose an operation, never as authorization.
export const listOperationsPath = '/v1/identity/operations';

// `required_level` is `anonymous`, `guest` or `account` (weakest to strongest); the backend may add
// values the client does not know. The operations the frontend asks for by name. The catalog may list others.
export const operations = {
  createSession: 'CREATE_SESSION',
  joinSessionAsAdmin: 'JOIN_SESSION_AS_ADMIN',
  joinSessionAsPlayer: 'JOIN_SESSION_AS_PLAYER',
  reportClientTelemetry: 'REPORT_CLIENT_TELEMETRY',
  viewOwnIdentity: 'VIEW_OWN_IDENTITY',
} as const;
export type Operation = (typeof operations)[keyof typeof operations];

export const listOperationsResponseSchema = z.object({
  operations: z.array(
    z.object({
      operation: z.string().min(1),
      required_level: z.string().min(1),
    }),
  ),
});

export type ListOperationsResponse = z.infer<typeof listOperationsResponseSchema>;
