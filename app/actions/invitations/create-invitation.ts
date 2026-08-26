'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/app/utils/email';
import { requireStaffOrAdmin } from '@/app/actions/_lib/require-staff-role';
import { generateInvitationCode } from '@/app/actions/_lib/invitation-code';
import type { CreateInvitationState } from './types';
import { isAllowedRelationship } from './types';

const MIN_FULL_NAME_LENGTH = 2;
const INVITATION_CODE_INSERT_ATTEMPTS = 5;
const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

export const createInvitation = async (
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> => {
  const childId = (formData.get('child_id') ?? '').toString();
  const fullName = (formData.get('full_name') ?? '').toString().trim();
  const email = (formData.get('email') ?? '').toString().trim();
  const relationship = (formData.get('relationship') ?? '').toString();

  if (fullName.length < MIN_FULL_NAME_LENGTH) {
    return { error: 'Ingresá un nombre.' };
  }

  if (!isValidEmail(email)) {
    return { error: 'Ingresá un email válido.' };
  }

  if (!isAllowedRelationship(relationship)) {
    return { error: 'Seleccioná un parentesco.' };
  }

  const { userId: staffUserId, daycareId } = await requireStaffOrAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: child } = await supabase
    .from('children')
    .select('room_id, rooms!inner(daycare_id)')
    .eq('id', childId)
    .single();

  if (child?.rooms?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  for (let attempt = 0; attempt < INVITATION_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const code = generateInvitationCode();
    const { error } = await supabase.from('invitations').insert({
      child_id: childId,
      invited_by: staffUserId,
      full_name: fullName,
      email,
      relationship,
      code,
      expires_at: expiresAt,
    });

    if (!error) {
      revalidatePath('/kids/[id]', 'page');
      return { error: null };
    }

    if (error.code !== '23505') {
      break;
    }
  }

  return { error: 'No pudimos crear la invitación. Probá de nuevo.' };
};
