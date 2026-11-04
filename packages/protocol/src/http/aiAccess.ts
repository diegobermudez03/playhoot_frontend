import { z } from 'zod';

// An account's AI connections through MCP (backend `api/README.md`, MCP and AI authorizations).
// An AI app starts an OAuth authorization at the backend, which sends the person to the web's
// consent page with the request's id; the page reads the request, and approving or denying it
// answers the URL the browser goes back to (the AI app's). Tokens never reach the web.

export const aiAuthorizationPath = (requestID: string) =>
  `/v1/ai-authorizations/${encodeURIComponent(requestID)}`;
export const aiAuthorizationApprovePath = (requestID: string) =>
  `${aiAuthorizationPath(requestID)}/approve`;
export const aiAuthorizationDenyPath = (requestID: string) =>
  `${aiAuthorizationPath(requestID)}/deny`;

// The scopes an AI may ask for; another value may come.
export const aiScopes = { games: 'games' } as const;

export const aiAuthorizationSchema = z.object({
  client_name: z.string(),
  client_uri: z.string().nullish(),
  // Where the browser goes back to once the person decides.
  redirect_host: z.string(),
  scopes: z.array(z.string()),
  expires_at: z.string(),
});

export const aiAuthorizationDecisionSchema = z.object({ redirect_url: z.string().min(1) });

export const aiConnectionsPath = '/v1/ai-connections';
export const aiConnectionRevokePath = (connectionID: string) =>
  `${aiConnectionsPath}/${encodeURIComponent(connectionID)}/revoke`;

export const aiConnectionsSchema = z.array(
  z.object({
    connection_id: z.string().min(1),
    client_name: z.string(),
    created_at: z.string(),
    last_used_at: z.string().nullish(),
  }),
);

export type AiAuthorizationResponse = z.infer<typeof aiAuthorizationSchema>;
export type AiConnectionsResponse = z.infer<typeof aiConnectionsSchema>;
