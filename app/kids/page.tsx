import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { listRooms } from '@/app/actions/rooms';
import { listChildren } from '@/app/actions/children';
import {
  assignColorsDeterministic,
  childToKidWithoutColor,
} from '@/app/lib/kid-mapper';
import { KidsBody } from '@/app/kids/KidsBody';

export default async function KidsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const [rooms, childrenRaw, currentUser] = await Promise.all([
    listRooms(),
    listChildren(),
    getCurrentUser(),
  ]);

  const kids = assignColorsDeterministic(
    childrenRaw.map(childToKidWithoutColor),
  );

  return <KidsBody currentUser={currentUser} rooms={rooms} kids={kids} />;
}
