'use server';

// SPEC 09: This action now returns `{ error: null }` on success and lets the
// client control the modal close. Previously it called `redirect('/kids')`,
// which made the client-side `isModalOpen` state survive the navigation and
// left the modal visible with stale data. We revalidate `/kids` so the list
// refreshes with the new row.
//
// `photo_consent` is intentionally omitted from the INSERT so the DB default
// (`true`) applies. The UI for photo consent will live in a future spec; the
// current `<form>` has no `name="photo_consent"` input either. Inserting
// `false` explicitly would be semantically wrong (consent revoked), so the
// field stays out of the server contract until that spec lands.

import { revalidatePath } from 'next/cache';
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
    })
    .select()
    .single();

  if (error) {
    return { error: 'No pudimos crear el niño. Probá de nuevo.' };
  }

  revalidatePath('/kids');
  return { error: null };
};
