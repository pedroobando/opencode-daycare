import type { Kid } from '@/app/lib/kids';
import { getAvatarTextColor } from '@/app/lib/kids';

interface KidProfileHeaderProps {
  kid: Kid;
}

export const KidProfileHeader = ({ kid }: KidProfileHeaderProps) => {
  const textColor = getAvatarTextColor(kid.color);

  return (
    <div className="flex items-center gap-[18px]">
      <div
        className="flex h-[84px] w-[84px] flex-none items-center justify-center rounded-full font-display text-[34px] font-semibold"
        style={{ backgroundColor: kid.color, color: textColor }}
      >
        {kid.initial}
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
          {kid.firstName} {kid.lastName}
        </h1>
        <p className="mt-1 text-[15px] text-muted-light">
          {kid.age} {kid.age === 1 ? 'año' : 'años'} · {kid.roomName}
        </p>
      </div>

      <a
        href="#"
        onClick={(event) => event.preventDefault()}
        className="flex-none rounded-xl border-[1.5px] border-card-border bg-card px-4 py-2 text-sm font-bold text-muted transition-colors hover:bg-background"
      >
        Editar
      </a>
    </div>
  );
};
