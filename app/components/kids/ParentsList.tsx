'use client';

import type { ParentViewModel } from '@/app/lib/parent-view-model';
import { getAvatarTextColor } from '@/app/lib/kids';
import { PlusIcon } from '@/app/components/icons';

interface ParentsListProps {
  parents: ParentViewModel[];
  onRequestLinkParent: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const statusConfig = {
  active: {
    label: 'ACTIVA',
    bgClass: 'bg-[#CFEBD8]',
    textClass: 'text-[#3E9B6C]',
    description: 'activa',
  },
  pending: {
    label: 'PENDIENTE',
    bgClass: 'bg-[#F7E7A6]',
    textClass: 'text-[#9A7B1E]',
    description: 'invitación enviada',
  },
};

const ParentItem = ({ parent }: { parent: ParentViewModel }) => {
  const config = statusConfig[parent.status];
  const textColor = getAvatarTextColor(parent.color);

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full font-display text-base font-semibold text-white"
        style={{ backgroundColor: parent.color, color: textColor }}
      >
        {parent.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-extrabold text-foreground">
          {parent.name}
        </div>
        <div className="text-[12.5px] text-muted-lighter">
          {parent.role} · {config.description}
        </div>
      </div>
      <span
        className={`flex-none rounded-full px-[9px] py-1 text-[10.5px] font-extrabold ${config.bgClass} ${config.textClass}`}
      >
        {config.label}
      </span>
    </div>
  );
};

export const ParentsList = ({
  parents,
  onRequestLinkParent,
  triggerRef,
}: ParentsListProps) => {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4">
      <div className="mb-3.5 text-[12.5px] font-extrabold tracking-[0.8px] text-muted-dark">
        PADRES VINCULADOS
      </div>

      <div className="flex flex-col gap-3.5">
        {parents.map((parent) => (
          <ParentItem key={parent.id} parent={parent} />
        ))}

        <button
          type="button"
          ref={triggerRef}
          onClick={onRequestLinkParent}
          className="flex items-center gap-3 pt-2"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-dashed border-placeholder-border text-placeholder-text">
            <PlusIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[14.5px] font-extrabold text-accent-dark">
            Vincular otro padre
          </span>
        </button>
      </div>
    </div>
  );
};
