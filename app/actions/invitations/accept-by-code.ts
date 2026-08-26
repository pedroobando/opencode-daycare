'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const acceptInvitationByCode = async (args: {
  code: string;
  authUserId: string;
  email: string;
}): Promise<{ error: string | null }> => {
  const supabase = await createSupabaseServerClient();

  const { data: inv, error: selectError } = await supabase
    .from('invitations')
    .select(
      '*, children!inner(room_id, rooms!inner(daycare_id))',
    )
    .eq('code', args.code)
    .maybeSingle();

  if (selectError || !inv) {
    return { error: 'Esta invitación no es para tu email.' };
  }

  if (inv.status !== 'pending') {
    return { error: 'Esta invitación ya no está disponible.' };
  }

  if (new Date(inv.expires_at).getTime() <= Date.now()) {
    return { error: 'Esta invitación expiró.' };
  }

  const { error: updateError } = await supabase
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inv.id);

  if (updateError) {
    return { error: 'No pudimos activar la invitación. Probá de nuevo.' };
  }

  const { error: linkError } = await supabase.from('parent_children').insert({
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
