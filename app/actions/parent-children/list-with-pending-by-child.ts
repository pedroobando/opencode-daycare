'use server';

import { listParentsByChild } from './list-by-child';
import { listInvitationsByChild } from '@/app/actions/invitations';
import { mergeParentRows } from '@/app/lib/parent-view-model';
import type { ParentViewModel } from '@/app/lib/parent-view-model';

export const listParentsWithPendingByChild = async (
  childId: string,
): Promise<ParentViewModel[]> => {
  const [links, invitations] = await Promise.all([
    listParentsByChild(childId),
    listInvitationsByChild(childId, { status: 'pending' }),
  ]);
  return mergeParentRows(links, invitations);
};
