'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import type { SidebarUser } from '@/lib/supabase/current-user';
import {
  LogoIcon,
  PlusIcon,
  HomeIcon,
  KidsIcon,
  BellIcon,
  UserIcon,
  LogoutIcon,
  CloseIcon,
} from '@/app/components/icons';

interface SidebarProps {
  onClose?: () => void;
  onNewPost?: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  currentUser?: SidebarUser | null;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const NavItem = ({ href, icon, label, isActive, onClick }: NavItemProps) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-[11px] text-[14.5px] transition-colors ${
        isActive
          ? 'bg-primary-light font-extrabold text-primary'
          : 'bg-transparent font-semibold text-muted hover:bg-card-border/30'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

export const Sidebar = ({
  onClose,
  onNewPost,
  triggerRef,
  currentUser,
}: SidebarProps) => {
  const pathname = usePathname();
  const isFeedActive = pathname === '/';
  const isKidsActive = pathname === '/kids' || pathname.startsWith('/kids/');

  const avatarColorClass = currentUser?.avatarColorClass ?? 'bg-avatar-coral';
  const initial = currentUser?.initial ?? 'C';
  const fullName = currentUser?.fullName ?? 'Caro Giménez';
  const roleLine = currentUser
    ? `${currentUser.roleLabel} · ${currentUser.daycareName}`
    : 'Maestra · Soles';

  if (currentUser === undefined && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[Sidebar] currentUser prop is undefined; falling back to mock identity.',
    );
  }

  return (
    <aside className="relative flex h-full w-[248px] flex-none flex-col border-r border-card-border bg-card px-4 py-6">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-muted-light hover:bg-background"
          aria-label="Cerrar menú"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}

      <Link
        href="/"
        className="flex items-center gap-[11px] px-2 pb-[22px] pt-2"
      >
        <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end">
          <LogoIcon className="h-[21px] w-[21px] text-white" />
        </div>
        <div>
          <div className="font-display text-[17px] font-semibold leading-none text-foreground">
            OpenDayCare
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-lighter">
            Sala Soles
          </div>
        </div>
      </Link>

      <button
        type="button"
        ref={triggerRef}
        onClick={onNewPost}
        className="mb-[18px] flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3 text-center text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.75)]"
      >
        <PlusIcon className="h-[17px] w-[17px]" />
        Nueva publicación
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        <NavItem
          href="/"
          icon={<HomeIcon className="h-[19px] w-[19px]" />}
          label="Feed"
          isActive={isFeedActive}
        />
        <NavItem
          href="/kids"
          icon={<KidsIcon className="h-[19px] w-[19px]" />}
          label="Niños"
          isActive={isKidsActive}
        />
        <NavItem
          href="#"
          icon={<BellIcon className="h-[19px] w-[19px]" />}
          label="Avisos"
          onClick={(event) => event.preventDefault()}
        />
        <NavItem
          href="#"
          icon={<UserIcon className="h-[19px] w-[19px]" />}
          label="Mi cuenta"
          onClick={(event) => event.preventDefault()}
        />
      </nav>

      <div className="mt-2.5 border-t border-card-border pt-3.5">
        <div className="flex items-center gap-[11px] px-2 py-1.5">
          <div
            className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full font-display text-base font-semibold text-white ${avatarColorClass}`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-foreground">
              {fullName}
            </div>
            <div className="text-xs text-muted-lighter">{roleLine}</div>
          </div>
          <form action={signOut} className="contents">
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-background text-muted-light hover:text-foreground"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
};
