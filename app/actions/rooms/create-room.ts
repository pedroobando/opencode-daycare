'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.rooms` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with
// "new row violates row-level security policy" until the write-policy spec
// lands. Structural verification only for now (see SPEC 08 §Riesgos).

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import type { CreateRoomState } from './types';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

const mapRoomError = (code: string | undefined): string => {
  if (code === '23505') {
    return 'Ya existe una sala con ese nombre.';
  }

  return 'No pudimos crear la sala. Probá de nuevo.';
};

export const createRoom = async (
  _prevState: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> => {
  const name = (formData.get('name') ?? '').toString().trim();

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return { error: 'El nombre debe tener entre 2 y 60 caracteres.' };
  }

  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('rooms')
    .insert({ daycare_id: daycareId, name })
    .select()
    .single();

  if (error) {
    return { error: mapRoomError(error.code) };
  }

  redirect('/kids');
};
