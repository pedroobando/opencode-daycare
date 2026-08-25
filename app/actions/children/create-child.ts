'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.children` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with
// "new row violates row-level security policy" until the write-policy spec
// lands. Structural verification only for now (see SPEC 08 §Riesgos).

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCurrentUserDaycareId } from '@/app/actions/_lib/current-daycare';
import { isDateInFuture, parseDdMmYyyy } from '@/app/actions/_lib/birth-date';
import type { CreateChildState } from './types';

const MIN_FULL_NAME_LENGTH = 2;

export const createChild = async (
  _prevState: CreateChildState,
  formData: FormData,
): Promise<CreateChildState> => {
  const fullName = (formData.get('full_name') ?? '').toString().trim();
  const birthDateInput = (formData.get('birth_date') ?? '').toString();
  const roomId = (formData.get('room_id') ?? '').toString();
  const medicalNotes = (formData.get('medical_notes') ?? '').toString().trim();
  const allergyTagsRaw = (formData.get('allergy_tags') ?? '').toString();
  const photoConsent = formData.get('photo_consent') === 'on';

  if (fullName.length < MIN_FULL_NAME_LENGTH) {
    return { error: 'Ingresá un nombre.' };
  }

  const birthDate = parseDdMmYyyy(birthDateInput);

  if (birthDate === null) {
    return { error: 'Ingresá una fecha con formato dd/mm/aaaa.' };
  }

  if (isDateInFuture(birthDate)) {
    return { error: 'La fecha no puede ser en el futuro.' };
  }

  if (roomId === '') {
    return { error: 'Seleccioná una sala.' };
  }

  const daycareId = await requireCurrentUserDaycareId();
  const supabase = await createSupabaseServerClient();

  // The room must belong to the user's daycare; never trust the form.
  const { data: room } = await supabase
    .from('rooms')
    .select('daycare_id')
    .eq('id', roomId)
    .single();

  if (room?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const allergyTags = allergyTagsRaw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

  const { error } = await supabase
    .from('children')
    .insert({
      room_id: roomId,
      full_name: fullName,
      birth_date: birthDate,
      medical_notes: medicalNotes || null,
      allergy_tags: allergyTags,
      photo_consent: photoConsent,
    })
    .select()
    .single();

  if (error) {
    return { error: 'No pudimos crear el niño. Probá de nuevo.' };
  }

  redirect('/kids');
};
