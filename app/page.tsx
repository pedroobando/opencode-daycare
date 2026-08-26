import { redirect } from 'next/navigation';
import { FeedBody } from '@/app/components/feed/FeedBody';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { listChildren } from '@/app/actions/children';
import {
  assignColorsDeterministic,
  childToKidWithoutColor,
} from '@/app/lib/kid-mapper';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const [childrenRaw, currentUser] = await Promise.all([
    listChildren(),
    getCurrentUser(),
  ]);

  const kids = assignColorsDeterministic(
    childrenRaw.map(childToKidWithoutColor),
  );

  return <FeedBody currentUser={currentUser} kids={kids} />;
}
