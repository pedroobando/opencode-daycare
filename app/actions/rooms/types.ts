import type { Database } from '@/database.types';

export type RoomRow = Database['public']['Tables']['rooms']['Row'];
export type RoomInsert = Database['public']['Tables']['rooms']['Insert'];
export type RoomUpdate = Database['public']['Tables']['rooms']['Update'];

export type CreateRoomState = {
  error: string | null;
};

export type UpdateRoomState = {
  error: string | null;
};
