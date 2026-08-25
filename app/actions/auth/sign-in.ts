'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMAIL_REGEX } from '@/app/utils/email';

export type SignInState = {
  error: string | null;
};

const mapAuthError = (code: string | undefined): string => {
  if (code === 'invalid_credentials') {
    return 'Email o contraseña incorrectos.';
  }

  if (code === 'over_email_send_rate_limit') {
    return 'Demasiados intentos. Probá más tarde.';
  }

  return 'No pudimos iniciar sesión. Probá de nuevo.';
};

export const signIn = async (
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> => {
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');

  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';

  if (email === '' || password === '' || !EMAIL_REGEX.test(email)) {
    return { error: 'Ingresá un email y una contraseña.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.code) };
  }

  redirect('/');
};
