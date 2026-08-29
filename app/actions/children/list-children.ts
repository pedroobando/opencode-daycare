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

  const children = data as ChildWithRoom[];
  const childIds = children.map((c) => c.id);

  if (childIds.length === 0) {
    return children.map((child) => ({
      ...child,
      parentCount: 0,
      pendingInvitationCount: 0,
    }));
  }

  // Two extra queries to count linked parents + pending invitations per child.
  // Done as a separate step (instead of embedding `parent_children(count)` in
  // the main select) because:
  //   1. It's portable across PostgREST versions — no dependency on the
  //      aggregate-relation feature for the embedded count.
  //   2. Filtering `invitations.status='pending'` cannot be expressed in an
  //      embedded aggregate count; it requires a separate filtered query.
  // `child_id IN (...)` is already tenant-scoped because `childIds` comes from
  // a query filtered by `rooms.daycare_id`.
  const [parentLinksResult, pendingInvitationsResult] = await Promise.all([
    supabase.from('parent_children').select('child_id').in('child_id', childIds),
    supabase
      .from('invitations')
      .select('child_id')
      .in('child_id', childIds)
      .eq('status', 'pending'),
  ]);

  const parentCountByChild: Record<string, number> = {};
  if (parentLinksResult.error) {
    console.warn(
      '[listChildren] parent_children count query failed:',
      parentLinksResult.error.message,
    );
  } else {
    for (const row of parentLinksResult.data ?? []) {
      parentCountByChild[row.child_id] =
        (parentCountByChild[row.child_id] ?? 0) + 1;
    }
  }

  const pendingInvitationCountByChild: Record<string, number> = {};
  if (pendingInvitationsResult.error) {
    console.warn(
      '[listChildren] invitations count query failed:',
      pendingInvitationsResult.error.message,
    );
  } else {
    for (const row of pendingInvitationsResult.data ?? []) {
      pendingInvitationCountByChild[row.child_id] =
        (pendingInvitationCountByChild[row.child_id] ?? 0) + 1;
    }
  }

  return children.map((child) => ({
    ...child,
    parentCount: parentCountByChild[child.id] ?? 0,
    pendingInvitationCount: pendingInvitationCountByChild[child.id] ?? 0,
  }));
};
