'use server';

// SPEC 11 — Inserta una invitación en `public.invitations` y envía el email
// vía Resend.com. Si el envío falla, hace rollback (DELETE) para evitar
// invitaciones "fantasma" en DB. Tras el envío OK, setea `sent_at = now()`
// para auditoría (DB-06).

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/app/utils/email';
import { requireStaffOrAdmin } from '@/app/actions/_lib/require-staff-role';
import { generateInvitationCode } from '@/app/actions/_lib/invitation-code';
import { InvitationEmail } from '@/lib/email/templates/InvitationEmail';
import { getResendClient } from '@/lib/email/resend';
import type { CreateInvitationState } from './types';
import { isAllowedRelationship } from './types';

const MIN_FULL_NAME_LENGTH = 2;
const INVITATION_CODE_INSERT_ATTEMPTS = 5;
const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
const EMAIL_SUBJECT = 'Te invitaron a OpenDayCare';

const ENV_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const ENV_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const ENV_FROM_NAME = process.env.RESEND_FROM_NAME ?? 'OpenDayCare';

const formatExpiresAt = (iso: string): string => {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
};

const rollbackInvitation = async (invitationId: string): Promise<void> => {
  const admin = createSupabaseAdminClient();
  await admin.from('invitations').delete().eq('id', invitationId);
};

const markInvitationSent = async (invitationId: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('invitations')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', invitationId);
  if (error) {
    console.warn(
      `[createInvitation] No se pudo actualizar sent_at para la invitación ${invitationId}:`,
      error.message,
    );
  }
};

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

  if (!ENV_APP_URL) {
    return {
      error: 'No pudimos enviar la invitación. Configurá NEXT_PUBLIC_APP_URL.',
    };
  }

  const { userId: staffUserId, daycareId } = await requireStaffOrAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: child } = await supabase
    .from('children')
    .select('id, full_name, rooms!inner(daycare_id, daycares!inner(name))')
    .eq('id', childId)
    .single();

  if (child?.rooms?.daycare_id !== daycareId) {
    return { error: 'No autorizado.' };
  }

  const childName = child?.full_name ?? '';
  const daycareName = child?.rooms?.daycares?.name ?? '';

  const expiresAtIso = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  for (let attempt = 0; attempt < INVITATION_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const code = generateInvitationCode();

    const { data: inserted, error: insertError } = await supabase
      .from('invitations')
      .insert({
        child_id: childId,
        invited_by: staffUserId,
        full_name: fullName,
        email,
        relationship,
        code,
        expires_at: expiresAtIso,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        continue;
      }
      return { error: 'No pudimos crear la invitación. Probá de nuevo.' };
    }

    const invitationId = inserted.id;
    const activationUrl = `${ENV_APP_URL}/auth/active?code=${code}`;
    const expiresAtFormatted = formatExpiresAt(expiresAtIso);

    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'mock') {
      console.warn(
        '[createInvitation] RESEND_API_KEY no configurada o es "mock": usando cliente mock. Configurá una API key real antes de prod.',
      );
    }

    const resend = getResendClient();
    const sendResult = await resend.emails.send({
      from: `${ENV_FROM_NAME} <${ENV_FROM_EMAIL}>`,
      to: email,
      subject: EMAIL_SUBJECT,
      react: InvitationEmail({
        parentName: fullName,
        childName,
        daycareName,
        code,
        activationUrl,
        expiresAt: expiresAtFormatted,
      }),
    });

    if (sendResult.error) {
      await rollbackInvitation(invitationId);
      revalidatePath('/kids/[id]', 'page');
      return { error: 'No pudimos enviar la invitación. Probá de nuevo.' };
    }

    await markInvitationSent(invitationId);
    revalidatePath('/kids/[id]', 'page');
    return { error: null };
  }

  return { error: 'No pudimos crear la invitación. Probá de nuevo.' };
};
