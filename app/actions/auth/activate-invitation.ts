'use server';

// SPEC 10 — `/auth/active` server action: signs up (or signs in if the user
// already exists) a parent via Supabase Auth, runs `acceptInvitationByCode`,
// and flips `public.users.status` to `'active'`.
//
// The trigger `handle_new_user` (DB-02) requires `daycare_id` in
// `raw_user_meta_data`. To get it, this action does a service-role read of the
// invitation before signUp (the `invitations_select_for_accept` policy only
// matches after the parent is authenticated, so the read cannot run under the
// session). The service-role client is server-only and never touches the
// browser. See `lib/supabase/admin.ts` for the safety boundary.
//
// When email confirmations are enabled and a user already exists, Supabase's
// signUp returns an obfuscated (fake) user instead of an error. To handle this,
// we detect the obfuscated response and fall back to signInWithPassword.

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/app/utils/email';
import { acceptInvitationByCode } from '@/app/actions/invitations';

const MIN_FULL_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;

export type ActivateInvitationState = {
  error: string | null;
};

const mapSignUpError = (code: string | undefined): string => {
  if (code === 'user_already_exists' || code === 'email_exists') {
    return 'Ya existe una cuenta con este email.';
  }
  if (code === 'weak_password' || code === 'password_too_short') {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  return 'No pudimos crear tu cuenta. Probá de nuevo.';
};

const mapSignInError = (code: string | undefined): string => {
  if (code === 'invalid_credentials') {
    return 'Ya existe una cuenta con este email. Ingresá la contraseña correcta.';
  }
  if (code === 'email_not_confirmed') {
    return 'Tu cuenta todavía no confirmó el email. Revisá tu casilla.';
  }
  return 'No pudimos iniciar sesión. Probá de nuevo.';
};

/**
 * Detect the obfuscated user returned by signUp when the user already exists
 * and email confirmations are enabled. The obfuscated user has
 * `email_confirmed_at: null` and was created within the last few seconds
 * (Supabase creates the fake user on the fly).
 */
const isObfuscatedUser = (
  user: { id: string; email_confirmed_at: string | null; created_at?: string },
): boolean => {
  if (user.email_confirmed_at !== null) return false;
  if (!user.created_at) return true;
  const createdAt = new Date(user.created_at).getTime();
  const now = Date.now();
  return now - createdAt < 5_000;
};

export const activateInvitation = async (
  _prev: ActivateInvitationState,
  formData: FormData,
): Promise<ActivateInvitationState> => {
  const email = (formData.get('email') ?? '').toString().trim();
  const code = (formData.get('code') ?? '').toString().trim().toUpperCase();
  const password = (formData.get('password') ?? '').toString();
  const fullName = (formData.get('full_name') ?? '').toString().trim();

  if (fullName.length < MIN_FULL_NAME_LENGTH) {
    return { error: 'Ingresá tu nombre.' };
  }

  if (!isValidEmail(email)) {
    return { error: 'Ingresá un email válido.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (code.length === 0) {
    return { error: 'Ingresá el código de invitación.' };
  }

  const admin = createSupabaseAdminClient();
  const { data: invitation, error: invitationError } = await admin
    .from('invitations')
    .select(
      'status, email, expires_at, child_id, children!inner(room_id, rooms!inner(daycare_id))',
    )
    .eq('code', code)
    .maybeSingle();

  if (invitationError || !invitation) {
    return { error: 'Esta invitación no es válida.' };
  }

  if (invitation.status !== 'pending') {
    return { error: 'Esta invitación ya no está disponible.' };
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { error: 'Esta invitación expiró.' };
  }

  if (invitation.email !== email) {
    return { error: 'Esta invitación no es para tu email.' };
  }

  const daycareId = invitation.children?.rooms?.daycare_id;
  if (!daycareId) {
    return { error: 'No pudimos resolver la guardería de la invitación.' };
  }

  const supabase = await createSupabaseServerClient();

  // Try signUp first. When email confirmations are enabled, an existing user
  // returns an obfuscated (fake) user with `email_confirmed_at: null` and a
  // `created_at` within the last few seconds instead of an error.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'parent',
        daycare_id: daycareId,
        invitation_code: code,
      },
    },
  });

  let authUserId: string;

  if (signUpError) {
    // Explicit error from Supabase (e.g., signup_disabled, weak_password).
    return { error: mapSignUpError(signUpError.code) };
  }

  if (
    signUpData.user &&
    isObfuscatedUser(signUpData.user as { id: string; email_confirmed_at: string | null; created_at?: string })
  ) {
    // Obfuscated response: user already exists. Try to sign in with the
    // provided password so the session is set for acceptInvitationByCode.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { error: mapSignInError(signInError.code) };
    }

    // Resolve the real user ID via the now-authenticated session.
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return { error: 'No pudimos autenticar tu cuenta. Probá de nuevo.' };
    }

    authUserId = sessionUser.id;
  } else if (signUpData.user) {
    // Genuine new user.
    authUserId = signUpData.user.id;
  } else {
    return { error: 'No pudimos crear tu cuenta. Probá de nuevo.' };
  }

  const acceptResult = await acceptInvitationByCode({
    code,
    authUserId,
    email,
  });

  if (acceptResult.error !== null) {
    return { error: acceptResult.error };
  }

  const { error: statusError } = await admin
    .from('users')
    .update({ status: 'active' })
    .eq('id', authUserId);

  if (statusError) {
    return { error: 'No pudimos activar tu cuenta. Probá de nuevo.' };
  }

  redirect('/');
};
