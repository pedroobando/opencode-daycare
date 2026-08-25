'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { RoomRow } from './types';

export const listRooms = async (): Promise<RoomRow[]> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('daycare_id', daycareId)
    .order('name', { ascending: true });

  if (error) {
    return [];
  }

  return data;
};
