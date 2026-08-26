import type { Database } from '@/database.types';

export type RelationshipType = Database['public']['Enums']['relationship_type'];
export type ParentChildRow =
  Database['public']['Tables']['parent_children']['Row'];
export type ParentChildInsert =
  Database['public']['Tables']['parent_children']['Insert'];

export type ParentChildWithUser = ParentChildRow & {
  users: { id: string; full_name: string; avatar_url: string | null } | null;
};

export type UnlinkParentState = {
  error: string | null;
};

export type LinkParentState = {
  error: string | null;
};
