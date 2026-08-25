'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { ChildWithRoom } from './types';

export const listChildren = async (opts?: {
  roomId?: string;
}): Promise<ChildWithRoom[]> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // `rooms!inner` forces an INNER JOIN: children without a valid room (or with
  // a room from another daycare) are filtered out, combining the multi-tenant
  // filter with referential integrity in a single query.
  let query = supabase
    .from('children')
    .select('*, rooms!inner(id, name, daycare_id)')
    .eq('rooms.daycare_id', daycareId)
    .order('full_name', { ascending: true });

  if (opts?.roomId) {
    query = query.eq('room_id', opts.roomId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data as ChildWithRoom[];
};
