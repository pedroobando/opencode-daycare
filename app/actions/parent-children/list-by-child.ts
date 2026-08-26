'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { ParentChildWithUser } from './types';

export const listParentsByChild = async (
  childId: string,
): Promise<ParentChildWithUser[]> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('parent_children')
    .select(
      '*, users!inner(id, full_name, avatar_url, daycare_id)',
    )
    .eq('users.daycare_id', daycareId)
    .eq('child_id', childId)
    .order('users(full_name)', { ascending: true });

  if (error) {
    return [];
  }

  return data as ParentChildWithUser[];
};
