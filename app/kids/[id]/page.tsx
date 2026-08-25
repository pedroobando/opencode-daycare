import { notFound, redirect } from 'next/navigation';
import { MobileDrawer } from '@/app/components/feed/MobileDrawer';
import { Sidebar } from '@/app/components/feed/Sidebar';
import { KidProfileBody } from '@/app/components/kids/KidProfileBody';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { getKidById } from '@/app/lib/kids';

interface KidProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function KidProfilePage({ params }: KidProfilePageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { id } = await params;
  const kid = getKidById(id);

  if (!kid) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <Sidebar currentUser={currentUser} />
      </div>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-6 pb-20 pt-8 sm:px-10">
          <MobileDrawer currentUser={currentUser} />

          <KidProfileBody kid={kid} />
        </div>
      </main>
    </div>
  );
}
