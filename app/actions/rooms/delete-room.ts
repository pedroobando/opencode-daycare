'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.rooms` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with an
// RLS error until the write-policy spec lands (see SPEC 08 §Riesgos).

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { UpdateRoomState } from './types';

const FK_VIOLATION_CODE = '23503';

export const deleteRoom = async (id: string): Promise<UpdateRoomState> => {
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

  const { error } = await supabase.from('rooms').delete().eq('id', id);

  if (error) {
    if (error.code === FK_VIOLATION_CODE) {
      return { error: 'No se puede borrar: la sala tiene niños activos.' };
    }

    return { error: 'No pudimos borrar la sala.' };
  }

  return { error: null };
};
