'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { RelationshipType } from './types';

export const linkParentFromInvitation = async (args: {
  parentUserId: string;
  childId: string;
  relationship: RelationshipType;
}): Promise<{ error: string | null }> => {
  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();

  const { data: child } = await supabase
    .from('children')
    .select('room_id, rooms!inner(daycare_id)')
    .eq('id', args.childId)
    .single();

  if (child?.rooms?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const { error } = await supabase.from('parent_children').insert({
    parent_id: args.parentUserId,
    child_id: args.childId,
    relationship: args.relationship,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este padre ya está vinculado a este niño.' };
    }
    return { error: 'No pudimos vincular al padre. Probá de nuevo.' };
  }

  revalidatePath('/kids/[id]', 'page');
  return { error: null };
};
