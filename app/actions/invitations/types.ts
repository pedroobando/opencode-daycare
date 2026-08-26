import type { Database } from '@/database.types';

export type InvitationStatus = Database['public']['Enums']['invitation_status'];
export type InvitationRow = Database['public']['Tables']['invitations']['Row'];
export type InvitationInsert =
  Database['public']['Tables']['invitations']['Insert'];

export type InvitationWithInviter = InvitationRow & {
  users: { id: string; full_name: string } | null;
};

export type CreateInvitationState = {
  error: string | null;
};

export type AcceptInvitationState = {
  error: string | null;
};

export const ALLOWED_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
] as const;

export const isAllowedRelationship = (
  value: string,
): value is (typeof ALLOWED_RELATIONSHIPS)[number] => {
  return (ALLOWED_RELATIONSHIPS as readonly string[]).includes(value);
};
