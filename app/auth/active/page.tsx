import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthActiveBody } from '@/app/auth/active/AuthActiveBody';

export default async function AuthActivePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Only redirect fully-active parents. SPEC 10 lets parents with a
    // pending status (signup OK but acceptInvitationByCode failed) retry
    // the flow from `/auth/active` with a valid code.
    const { data: profile } = await supabase
      .from('users')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.status === 'active') {
      redirect('/');
    }
  }

  return <AuthActiveBody />;
}
