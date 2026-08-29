import type { Database } from '@/database.types';

export type ChildRow = Database['public']['Tables']['children']['Row'];
export type ChildInsert = Database['public']['Tables']['children']['Insert'];
export type ChildUpdate = Database['public']['Tables']['children']['Update'];

export type ChildWithRoom = ChildRow & {
  rooms: { id: string; name: string; daycare_id: string } | null;
  parentCount: number;
  pendingInvitationCount: number;
};

export type CreateChildState = {
  error: string | null;
};

export type UpdateChildState = {
  error: string | null;
};
