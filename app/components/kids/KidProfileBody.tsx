'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AllergyAlert } from '@/app/components/kids/AllergyAlert';
import { InactiveLink } from '@/app/components/kids/InactiveLink';
import { KidProfileHeader } from '@/app/components/kids/KidProfileHeader';
import { ParentsList } from '@/app/components/kids/ParentsList';
import { LinkParentModal } from '@/app/components/kids/LinkParentModal';
import { ArrowLeftIcon, LogoIcon } from '@/app/components/icons';
import type { Kid, Parent } from '@/app/lib/kids';

interface KidProfileBodyProps {
  kid: Kid;
}

const formatDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatMonthYear = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat('es', {
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const KidProfileBody = ({ kid }: KidProfileBodyProps) => {
  const [parents, setParents] = useState<Parent[]>(kid.linkedParents);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const kidFullName = `${kid.firstName} ${kid.lastName}`.trim();

  return (
    <>
      <Link
        href="/kids"
        className="mb-5 flex items-center gap-[7px] text-sm font-bold text-muted-light transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="h-[18px] w-[18px]" />
        Volver a Niños
      </Link>

      <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <KidProfileHeader kid={kid} />

          {kid.allergies && <AllergyAlert allergies={kid.allergies} />}

          <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <div className="flex justify-between border-b border-card-border px-[18px] py-[15px]">
              <span className="text-[14.5px] text-muted-light">
                Fecha de nacimiento
              </span>
              <span className="text-[14.5px] font-extrabold text-foreground">
                {formatDate(kid.birthDate)}
              </span>
            </div>
            <div className="flex justify-between border-b border-card-border px-[18px] py-[15px]">
              <span className="text-[14.5px] text-muted-light">Sala</span>
              <span className="text-[14.5px] font-extrabold text-foreground">
                {kid.roomName.replace('Sala ', '')}
              </span>
            </div>
            <div className="flex justify-between px-[18px] py-[15px]">
              <span className="text-[14.5px] text-muted-light">Ingreso</span>
              <span className="text-[14.5px] font-extrabold text-foreground">
                {formatMonthYear(kid.enrollmentDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <InactiveLink className="flex items-center justify-center gap-2 rounded-[14px] bg-foreground py-[13px] text-center text-[15px] font-extrabold text-white">
            <LogoIcon className="h-[18px] w-[18px]" />
            Resumen del día
          </InactiveLink>

          <ParentsList
            parents={parents}
            onRequestLinkParent={() => setIsModalOpen(true)}
            triggerRef={triggerRef}
          />
        </div>
      </div>

      <LinkParentModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        kidId={kid.id}
        kidName={kidFullName}
        existingParents={parents}
        onAddParent={(parent) => setParents((previous) => [...previous, parent])}
        triggerRef={triggerRef}
      />
    </>
  );
};
