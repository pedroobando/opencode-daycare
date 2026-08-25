'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.rooms` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with an
// RLS error until the write-policy spec lands (see SPEC 08 §Riesgos).

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { UpdateRoomState } from './types';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

export const updateRoom = async (
  id: string,
  patch: { name?: string },
): Promise<UpdateRoomState> => {
  if (
    patch.name !== undefined &&
    (patch.name.trim().length < MIN_NAME_LENGTH ||
      patch.name.trim().length > MAX_NAME_LENGTH)
  ) {
    return { error: 'El nombre debe tener entre 2 y 60 caracteres.' };
  }

  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createSupabaseServerClient();

  const { data: room } = await supabase
    .from('rooms')
    .select('daycare_id')
    .eq('id', id)
    .single();

  if (room?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const { error } = await supabase.from('rooms').update(patch).eq('id', id);

  if (error) {
    return { error: 'No pudimos actualizar la sala.' };
  }

  return { error: null };
};
