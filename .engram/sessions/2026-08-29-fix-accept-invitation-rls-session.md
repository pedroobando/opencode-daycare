## Goal
Fix bug where /auth/active returned "Esta invitación no es para tu email o ya no está disponible." when the invitation and email matched, because `acceptInvitationByCode`'s SELECT was gated by an RLS policy that required a JWT session that the activation flow never established (Supabase signUp with email confirmations enabled does not auto-sign-in the user).

## Instructions
- Use admin client in `app/actions/invitations/accept-by-code.ts` and `app/actions/auth/activate-invitation.ts` for mutations that require RLS bypass (no JWT during activation).
- Keep inline anti-IDOR validation in accept-by-code.ts (`inv.email === args.email`, `status === 'pending'`, `expires_at > now()`).
- UI copy stays in Spanish (voseo). Code identifiers in English.

## Discoveries
- The user `pedroobando@hotmail.com` was in `auth.users` with `email_confirmed_at: null`, `public.users.status='pending'`, no `parent_children` link, no `auth.sessions`. Root cause: `signUp` does NOT establish a session when email confirmations are enabled, so `auth.jwt() ->> 'email'` is NULL and `invitations_select_for_accept` filters out the row, returning the misleading "no es para tu email" error.
- SPEC 11 had already added `invitations_update_for_accept` and `parent_children_insert_for_accept`, but those still require a JWT — same root cause affects UPDATE/INSERT in addition to SELECT.
- `isObfuscatedUser`'s `now - created_at < 5_000` check only flips behavior in the first 5s after signUp; on retry (user already exists >5s), the flow falls into the genuine-new-user branch and never attempts `signInWithPassword`, so no session is ever established.
- `signInWithPassword` against an unconfirmed user fails with `email_not_confirmed`, so we cannot rely on establishing a session post-signup without auto-confirming.
- SPEC 10 verification (test #5/7 in §Resultados) used SQL with `set_config('request.jwt.claims', ...)` rather than the real Next.js server action — it never caught this end-to-end bug.

## Accomplished
- Modified `app/actions/invitations/accept-by-code.ts` to use `createSupabaseAdminClient()` for SELECT + UPDATE + INSERT, with inline `inv.email.toLowerCase() === args.email.toLowerCase()` check; added `.eq('email', args.email).eq('status', 'pending')` to the UPDATE so it cannot stomp other rows.
- Modified `app/actions/auth/activate-invitation.ts` line 189 to use `admin` (instead of `supabase` server client) for the final `users.status = 'active'` flip — RLS on `users_update_self` requires `id = auth.uid()` which isn't set.
- `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0.
- Verified end-to-end against DB for `pedroobando@hotmail.com`:
  - invitation `C4W8LS` → `status='accepted'`
  - `parent_children` link created for child `ff71a7bd-...`, relationship `'guardian'`
  - `public.users.status` → `'active'`

## Next Steps
- The user can now log in at `/auth` with `pedroobando@hotmail.com` + their password. They still need to confirm their email first (since `email_confirmed_at` is null and `signInWithPassword` requires confirmation). They should check `pedroobando@hotmail.com`'s inbox for Supabase's confirmation email. If the link expired or was never delivered, ask to either resend or auto-confirm (`update auth.users set email_confirmed_at = now() where id = 'df9ba65f-…'`).
- Optional: persist this fix in a spec — `specs/dbase/07-accept-invitation-admin-client.md` — documenting the deviation from SPEC 10 (use admin client instead of server client for the accept flow).
- Optional: also fix the analogous issue in `activateInvitation.ts` for the `signInWithPassword` obfuscated branch — currently it will surface `email_not_confirmed` if the user retries without confirming. Could auto-confirm in the trigger to remove the need for email confirmation entirely in this flow (Option C from the plan).

## Relevant Files
- `app/actions/invitations/accept-by-code.ts` — fixed; admin client + inline validation
- `app/actions/auth/activate-invitation.ts:189` — fixed; admin client for status flip
- `supabase/migrations/20260826120000_create_parent_children_invitations.sql:134-140` — `invitations_select_for_accept` policy that was blocking SELECT
- `supabase/migrations/20260827000000_add_invitation_accept_rls_policies.sql` — UPDATE/INSERT policies for parent (also blocked by missing JWT)
- `specs/10-parent-children-and-invitations-server-actions.md` — original spec; didn't account for no-session case during activation
