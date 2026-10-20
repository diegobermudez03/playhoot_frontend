import { z } from 'zod';

// POST /v1/guests (backend `api/identity/create_guest.go`).
export const createGuestPath = '/v1/guests';

export const guestDisplayNameMaxLength = 64;

export interface CreateGuestRequest {
  display_name: string;
  idempotency_key: string;
}

export const createGuestResponseSchema = z.object({
  user_uuid: z.string().min(1),
  token: z.string().min(1),
});

export type CreateGuestResponse = z.infer<typeof createGuestResponseSchema>;
