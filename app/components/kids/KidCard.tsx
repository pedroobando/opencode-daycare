import Link from 'next/link';
import type { Kid } from '@/app/lib/kids';
import { getAvatarTextColor } from '@/app/lib/kids';
import { ChevronRightIcon } from '@/app/components/icons';

interface KidCardProps {
  kid: Kid;
}

const extractAllergyLabel = (allergyText: string): string => {
  const match = allergyText.match(/(?:al|a la|a los)\s+([a-záéíóúñ]+)/i);
  const label = match?.[1] ?? allergyText.split(' ')[0];
  return label.toUpperCase();
};

export const KidCard = ({ kid }: KidCardProps) => {
  const parentCount = kid.linkedParents.length;
  const parentLabel =
    parentCount === 0
      ? 'sin padres vinculados'
      : `${parentCount} ${parentCount === 1 ? 'padre vinculado' : 'padres vinculados'}`;

  const showAllergyBadge = Boolean(kid.allergies);
  const showLinkBadge = parentCount === 0;
  const allergyLabel = kid.allergies ? extractAllergyLabel(kid.allergies) : '';

  const textColor = getAvatarTextColor(kid.color);

  return (
    <Link
      href={`/kids/${kid.id}`}
      className="group flex items-center gap-3.5 rounded-[18px] border border-card-border bg-card p-4 shadow-[0_4px_14px_-12px_rgba(120,90,60,0.5)] transition-all hover:-translate-y-0.5 hover:border-primary-gradient-start"
    >
      <div
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-display text-[19px] font-semibold"
        style={{ backgroundColor: kid.color, color: textColor }}
      >
        {kid.initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-semibold text-foreground">
          {kid.firstName} {kid.lastName}
        </div>
        <div className="text-[13px] text-muted-lighter">
          {kid.age} {kid.age === 1 ? 'año' : 'años'} · {parentLabel}
        </div>
      </div>

      {showAllergyBadge && (
        <span className="flex-none rounded-full bg-[#FBD8CC] px-[9px] py-[5px] text-[11px] font-extrabold text-[#D9684A]">
          {allergyLabel}
        </span>
      )}

      {showLinkBadge && (
        <span className="flex-none rounded-full bg-[#F9D2DE] px-[9px] py-[5px] text-[11px] font-extrabold text-[#C56486]">
          VINCULAR
        </span>
      )}

      {!showAllergyBadge && !showLinkBadge && (
        <ChevronRightIcon className="h-[18px] w-[18px] flex-none text-[#CBB89F]" />
      )}
    </Link>
  );
};
