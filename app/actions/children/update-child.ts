'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.children` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with an
// RLS error until the write-policy spec lands (see SPEC 08 §Riesgos).

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import { parseDdMmYyyy } from '@/app/actions/_lib/birth-date';
import type { UpdateChildState } from './types';

export type UpdateChildPatch = {
  full_name?: string;
  birth_date?: string;
  room_id?: string;
  medical_notes?: string | null;
  allergy_tags?: string[];
  photo_consent?: boolean;
  status?: 'active' | 'archived';
};

export const updateChild = async (
  id: string,
  patch: UpdateChildPatch,
): Promise<UpdateChildState> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createSupabaseServerClient();

  // Ownership check: the child's current room must belong to the user's daycare.
  const { data: child } = await supabase
    .from('children')
    .select('room_id')
    .eq('id', id)
    .single();

  if (!child) {
    return { error: 'No autorizado.' };
  }

  const { data: currentRoom } = await supabase
    .from('rooms')
    .select('daycare_id')
    .eq('id', child.room_id)
    .single();

  if (currentRoom?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  // If the room changes, the new room must belong to the user's daycare too.
  if (patch.room_id !== undefined) {
    const { data: newRoom } = await supabase
      .from('rooms')
      .select('daycare_id')
      .eq('id', patch.room_id)
      .single();

    if (newRoom?.daycare_id !== daycareId) {
      return { error: 'No autorizado.' };
    }
  }

  // Accept `dd/mm/aaaa` input and normalize it to ISO before updating.
  const updatePayload = { ...patch };
  if (updatePayload.birth_date !== undefined) {
    const parsed = parseDdMmYyyy(updatePayload.birth_date);
    if (parsed === null) {
      return { error: 'Ingresá una fecha con formato dd/mm/aaaa.' };
    }
    updatePayload.birth_date = parsed;
  }

  const { error } = await supabase
    .from('children')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    return { error: 'No pudimos actualizar el niño.' };
  }

  return { error: null };
};
