'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MenuIcon } from '@/app/components/icons';
import type { SidebarUser } from '@/lib/supabase/current-user';

interface MobileDrawerProps {
  onNewPost?: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  currentUser?: SidebarUser | null;
}

export const MobileDrawer = ({
  onNewPost,
  triggerRef,
  currentUser,
}: MobileDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-foreground shadow-sm lg:hidden"
        aria-label="Abrir menú"
        aria-expanded={isOpen}
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex bg-black/30 lg:hidden"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(event) => event.stopPropagation()}>
            <Sidebar
              currentUser={currentUser}
              onClose={() => setIsOpen(false)}
              onNewPost={() => {
                setIsOpen(false);
                onNewPost?.();
              }}
              triggerRef={triggerRef}
            />
          </div>
        </div>
      )}
    </>
  );
};
