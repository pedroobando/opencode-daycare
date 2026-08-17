'use client';

import { CameraIcon } from '@/app/components/icons';

export function CreatePostPrompt() {
  function preventDefault(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
  }

  return (
    <a
      href="#"
      onClick={preventDefault}
      className="mb-6 flex items-center gap-3.5 rounded-[18px] border border-card-border bg-card px-[18px] py-3.5 shadow-[0_4px_14px_-10px_rgba(120,90,60,0.4)]"
    >
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-avatar-coral font-display text-base font-semibold text-white">
        C
      </div>
      <span className="flex-1 text-[15px] text-muted-lighter">
        Compartí un momento…
      </span>
      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-primary-light text-accent">
        <CameraIcon className="h-[19px] w-[19px]" />
      </span>
    </a>
  );
}
