'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';

export const cancelInvitation = async (
  invitationId: string,
): Promise<{ error: string | null }> => {
  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();

  const { data: inv } = await supabase
    .from('invitations')
    .select('status, child_id, children!inner(room_id, rooms!inner(daycare_id))')
    .eq('id', invitationId)
    .single();

  if (inv?.children?.rooms?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  if (inv.status !== 'pending') {
    return { error: 'Esta invitación ya no se puede cancelar.' };
  }

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);

  if (error) {
    return { error: 'No pudimos cancelar la invitación. Probá de nuevo.' };
  }

  revalidatePath('/kids/[id]', 'page');
  return { error: null };
};
