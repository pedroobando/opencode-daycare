import { redirect } from 'next/navigation';
import { FeedBody } from '@/app/components/feed/FeedBody';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return <FeedBody />;
}
