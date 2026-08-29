import type { RelationshipType, ParentChildWithUser } from '@/app/actions/parent-children';
import type { InvitationWithInviter } from '@/app/actions/invitations';
import { pickNextColor } from '@/app/utils/avatar-colors';

export type ParentViewModelStatus = 'active' | 'pending';

export type ParentViewModel = {
  id: string;
  name: string;
  role: string;
  status: ParentViewModelStatus;
  initial: string;
  color: string;
};

export const ROLE_LABEL: Record<RelationshipType, string> = {
  father: 'Papá',
  mother: 'Mamá',
  guardian: 'Tutor/a',
};

export const parentChildToViewModel = (
  link: ParentChildWithUser,
  existing: ParentViewModel[],
): ParentViewModel | null => {
  const fullName = link.users?.full_name ?? '';
  if (fullName === '') {
    return null;
  }

  return {
    id: link.id,
    name: fullName,
    role: ROLE_LABEL[link.relationship],
    status: 'active',
    initial: fullName.charAt(0).toUpperCase(),
    color: pickNextColor(existing, (p) => p.color),
  };
};

export const pendingInvitationToViewModel = (
  inv: InvitationWithInviter,
  existing: ParentViewModel[],
): ParentViewModel => {
  const fullName = inv.full_name;
  return {
    id: `inv:${inv.id}`,
    name: fullName,
    role: ROLE_LABEL[inv.relationship],
    status: 'pending',
    initial: fullName.charAt(0).toUpperCase(),
    color: pickNextColor(existing, (p) => p.color),
  };
};

export const mergeParentRows = (
  links: ParentChildWithUser[],
  invitations: InvitationWithInviter[],
): ParentViewModel[] => {
  const result: ParentViewModel[] = [];
  for (const link of links) {
    const mapped = parentChildToViewModel(link, result);
    if (mapped !== null) {
      result.push(mapped);
    }
  }
  for (const inv of invitations) {
    if (inv.status === 'pending') {
      result.push(pendingInvitationToViewModel(inv, result));
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
};
