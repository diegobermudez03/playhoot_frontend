import type { CredentialProvider } from '@playhoot/app-core';
import { authErrorCodes, errorBodySchema } from '@playhoot/protocol';

import { err, ok, type Result } from './result';

// Why an HTTP operation failed, by origin. Features decide how to present each case.
export type HttpFailure =
  // The request never got an HTTP answer (offline, DNS, CORS, aborted).
  | { kind: 'network'; message: string }
  // The backend answered with an error status. `code` is the backend's stable reason when present.
  | {
      kind: 'http';
      status: number;
      code: string | undefined;
      message: string;
      retryAfterSeconds: number | undefined;
    }
  // The backend answered successfully but the body does not match the contract.
  | { kind: 'decode'; status: number; message: string };

// Anything that can validate an unknown value into T (a zod schema satisfies it).
export interface Decoder<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export interface HttpRequest<T> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  response: Decoder<T>;
  // Attach the current credential. Defaults to true.
  authenticated?: boolean;
  // Let the request outlive the page (sent while it unloads). Small bodies only (64 KiB in all).
  keepalive?: boolean;
}

export interface HttpClient {
  request<T>(request: HttpRequest<T>): Promise<Result<T, HttpFailure>>;
}

export interface HttpClientOptions {
  // Prefix for every path. Empty means same origin (the dev proxy, or a same-origin deployment).
  baseUrl: string;
  credentials: CredentialProvider;
  // Called when the backend rejects the credential we sent as invalid and it could not be renewed,
  // so the app can forget it.
  onCredentialRejected?: () => void;
  fetch?: typeof fetch;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  const send = async <T>(
    request: HttpRequest<T>,
    afterRefresh: boolean,
  ): Promise<Result<T, HttpFailure>> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';

    const token = request.authenticated === false ? null : options.credentials.currentToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(options.baseUrl + request.path, {
        method: request.method,
        headers,
        ...(request.keepalive && { keepalive: true }),
        ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
      });
    } catch (cause) {
      return err({
        kind: 'network',
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }

    const body = await readJson(response);

    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(body);
      const code = parsed.success ? parsed.data.code : undefined;
      if (token && response.status === 401 && code === authErrorCodes.tokenInvalid) {
        // A refused access token is renewed once and the request sent again. Only a credential
        // the backend refuses to renew is forgotten; one that could not be renewed for now (the
        // backend unreachable) is kept, and this request fails.
        const renewal = afterRefresh ? 'invalid' : await options.credentials.refresh?.();
        if (renewal === 'renewed') return send(request, true);
        if (renewal !== 'unavailable') options.onCredentialRejected?.();
      }
      return err({
        kind: 'http',
        status: response.status,
        code,
        message: parsed.success ? parsed.data.message : response.statusText,
        retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')),
      });
    }

    const decoded = request.response.safeParse(body);
    if (!decoded.success) {
      return err({
        kind: 'decode',
        status: response.status,
        message: `unexpected response body for ${request.method} ${request.path}`,
      });
    }
    return ok(decoded.data);
  };

  return { request: (request) => send(request, false) };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
