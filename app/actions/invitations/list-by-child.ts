'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { InvitationStatus, InvitationWithInviter } from './types';

export const listInvitationsByChild = async (
  childId: string,
  opts?: { status?: InvitationStatus },
): Promise<InvitationWithInviter[]> => {
  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('invitations')
    .select('*, users!inner(id, full_name, daycare_id)')
    .eq('users.daycare_id', daycareId)
    .eq('child_id', childId)
    .order('created_at', { ascending: false });

  if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data as InvitationWithInviter[];
};
