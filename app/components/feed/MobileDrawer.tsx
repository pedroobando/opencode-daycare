'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MenuIcon } from '@/app/components/icons';

export const MobileDrawer = () => {
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
            <Sidebar onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
