import { Sidebar } from '@/app/components/feed/Sidebar';
import { MobileDrawer } from '@/app/components/feed/MobileDrawer';
import { KidNotFound } from '@/app/components/kids/KidNotFound';

export default function KidNotFoundPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-6 pb-20 pt-8 sm:px-10">
          <MobileDrawer />
          <KidNotFound message="Niño inexistente" />
        </div>
      </main>
    </div>
  );
}
