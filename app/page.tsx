import { redirect } from 'next/navigation';
import { FeedBody } from '@/app/components/feed/FeedBody';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/current-user';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const currentUser = await getCurrentUser();

  return <FeedBody currentUser={currentUser} />;
}
