'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';

export const unlinkParent = async (
  linkId: string,
): Promise<{ error: string | null }> => {
  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();

  const { data: link } = await supabase
    .from('parent_children')
    .select('child_id, children!inner(room_id, rooms!inner(daycare_id))')
    .eq('id', linkId)
    .single();

  if (link?.children?.rooms?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const { error } = await supabase
    .from('parent_children')
    .delete()
    .eq('id', linkId);

  if (error) {
    return { error: 'No pudimos desvincular al padre. Probá de nuevo.' };
  }

  revalidatePath('/kids/[id]', 'page');
  return { error: null };
};
