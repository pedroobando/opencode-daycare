'use server';

// SPEC 10 — `/auth/active` server action: signs up a parent via Supabase Auth,
// runs `acceptInvitationByCode`, and flips `public.users.status` to `'active'`.
//
// The trigger `handle_new_user` (DB-02) requires `daycare_id` in
// `raw_user_meta_data`. To get it, this action does a service-role read of the
// invitation before signUp (the `invitations_select_for_accept` policy only
// matches after the parent is authenticated, so the read cannot run under the
// session). The service-role client is server-only and never touches the
// browser. See `lib/supabase/admin.ts` for the safety boundary.

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

  if (signUpError || !signUpData.user) {
    return { error: mapSignUpError(signUpError?.code) };
  }

  const acceptResult = await acceptInvitationByCode({
    code,
    authUserId: signUpData.user.id,
    email,
  });

  if (acceptResult.error !== null) {
    return { error: acceptResult.error };
  }

  const { error: statusError } = await supabase
    .from('users')
    .update({ status: 'active' })
    .eq('id', signUpData.user.id);

  if (statusError) {
    return { error: 'No pudimos activar tu cuenta. Probá de nuevo.' };
  }

  redirect('/');
};
