'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const acceptInvitationByCode = async (args: {
  code: string;
  authUserId: string;
  email: string;
}): Promise<{ error: string | null }> => {
  const admin = createSupabaseAdminClient();

  const { data: inv, error: selectError } = await admin
    .from('invitations')
    .select(
      'id, code, status, email, relationship, child_id, expires_at',
    )
    .eq('code', args.code)
    .maybeSingle();

  if (selectError) {
    return { error: 'No pudimos validar la invitación. Probá de nuevo.' };
  }

  if (!inv) {
    return {
      error: 'Esta invitación no es para tu email o ya no está disponible.',
    };
  }

  if (inv.email.toLowerCase() !== args.email.toLowerCase()) {
    return { error: 'Esta invitación no es para tu email.' };
  }

  if (inv.status !== 'pending') {
    return { error: 'Esta invitación ya no está disponible.' };
  }

  if (new Date(inv.expires_at).getTime() <= Date.now()) {
    return { error: 'Esta invitación expiró.' };
  }

  const { error: updateError } = await admin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inv.id)
    .eq('email', args.email)
    .eq('status', 'pending');

  if (updateError) {
    return { error: 'No pudimos activar la invitación. Probá de nuevo.' };
  }

  const { error: linkError } = await admin.from('parent_children').insert({
    parent_id: args.authUserId,
    child_id: inv.child_id,
    relationship: inv.relationship,
  });

  if (linkError) {
    if (linkError.code === '23505') {
      return { error: 'Este código ya fue usado.' };
    }
    return { error: 'No pudimos activar la invitación. Probá de nuevo.' };
  }

  return { error: null };
};
