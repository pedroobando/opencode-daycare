import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { KidsBody } from '@/app/kids/KidsBody';

export default async function KidsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const currentUser = await getCurrentUser();

  return <KidsBody currentUser={currentUser} />;
}
