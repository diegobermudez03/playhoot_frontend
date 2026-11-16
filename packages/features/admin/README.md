# @playhoot/feature-admin

Admin area feature (logical state and ports). D-023.

Status: IMPLEMENTED: the admin-mode session, second-factor enrollment, admin sign-in, the inline
step-up of a sensitive action, and the three H2 panels (queues/DLQ, budget, email).

## Owns

- **The admin-mode session**: the 15-minute token a TOTP code buys, held in memory only, released
  when it expires or when the person leaves admin mode. It is the credential every `/admin/v1`
  call is made with; the account credential never reaches those addresses.
- **The second factor**: starting an enrollment, confirming it with its first code, replacing a
  confirmed credential with a current code, and turning a code into a single-use step-up proof.
- **The panels**: what each one reads, what its actions send, and which outcome kind presentation
  must show. A sensitive action asks for a fresh code, spends it as `step_up_proof`, and treats
  `step_up_required` as "ask again" (D-011, D-017).
- **QR encoding** of the otpauth URI, so the secret is never sent to an outside service.

## Does not own

- Presentation, text and layout (apps/web).
- Authorization: the backend decides it. A panel showing a button never means the action is
  allowed, and a 401 or 403 from the backend always wins.
- The meaning of a backend value (a queue name, a budget category, a delivery state): they are
  carried through as the backend wrote them and never treated as a closed list.
