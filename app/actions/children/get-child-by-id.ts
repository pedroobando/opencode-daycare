'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { ChildWithRoom } from './types';

export const getChildById = async (
  id: string,
): Promise<ChildWithRoom | null> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('children')
    .select('*, rooms!inner(id, name, daycare_id)')
    .eq('rooms.daycare_id', daycareId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as ChildWithRoom | null;
};
