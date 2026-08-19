'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AddKidForm, AddKidFormPayload } from '@/app/components/kids/AddKidForm';
import type { Kid, Room } from '@/app/lib/kids';

interface AddKidModalProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  existingKids: Kid[];
  onAddKid: (kid: Kid) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const useMounted = (): boolean => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
};

const AVATAR_COLOR_PALETTE = [
  '#A9D9E8',
  '#A9C7E8',
  '#F4B8CC',
  '#B9DEC4',
  '#F4DC8E',
  '#C9B6E8',
];

const differenceInYears = (dateLeft: Date, dateRight: Date): number => {
  const years = dateLeft.getFullYear() - dateRight.getFullYear();
  const monthDiff = dateLeft.getMonth() - dateRight.getMonth();
  const dayDiff = dateLeft.getDate() - dateRight.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    return years - 1;
  }

  return years;
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const slugify = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const pickNextColor = (kids: Kid[]): string => {
  const colorUsage = AVATAR_COLOR_PALETTE.map((color) => ({
    color,
    count: kids.filter(
      (kid) => kid.color.toUpperCase() === color.toUpperCase(),
    ).length,
  }));

  colorUsage.sort((a, b) => a.count - b.count);

  return colorUsage[0].color;
};

interface BuildKidPayload {
  fullName: string;
  birthDate: Date;
  roomId: string;
  allergies: string;
}

const buildKid = (
  payload: BuildKidPayload,
  existingKids: Kid[],
  rooms: Room[],
): Kid => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trimmedFullName = payload.fullName.trim();
  const firstSpaceIndex = trimmedFullName.indexOf(' ');

  const firstName =
    firstSpaceIndex === -1
      ? trimmedFullName
      : trimmedFullName.slice(0, firstSpaceIndex);
  const lastName =
    firstSpaceIndex === -1
      ? ''
      : trimmedFullName.slice(firstSpaceIndex + 1).trim();

  let id = slugify(`${firstName}-${lastName}`);

  if (existingKids.some((kid) => kid.id === id)) {
    id = `${id}-${Date.now()}`;
  }

  const selectedRoom = rooms.find((room) => room.id === payload.roomId);

  if (!selectedRoom) {
    throw new Error(`Room with id "${payload.roomId}" was not found.`);
  }

  return {
    id,
    firstName,
    lastName,
    age: differenceInYears(today, payload.birthDate),
    birthDate: formatLocalDate(payload.birthDate),
    roomId: selectedRoom.id,
    roomName: selectedRoom.name,
    enrollmentDate: formatLocalDate(today),
    initial: firstName.charAt(0).toUpperCase(),
    color: pickNextColor(existingKids),
    allergies: payload.allergies === '' ? undefined : payload.allergies,
    linkedParents: [],
  };
};

export const AddKidModal = ({
  open,
  onClose,
  rooms,
  existingKids,
  onAddKid,
  triggerRef,
}: AddKidModalProps) => {
  const mounted = useMounted();
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      if (open) {
        document.body.style.overflow = '';
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !cardRef.current) {
      return;
    }

    const firstInput = cardRef.current.querySelector<HTMLInputElement>(
      'input, select, textarea',
    );

    firstInput?.focus();
  }, [open]);

  useEffect(() => {
    if (open) {
      return;
    }

    const previousElement = previousActiveElementRef.current;

    if (
      previousElement instanceof HTMLElement &&
      document.contains(previousElement)
    ) {
      previousElement.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open, triggerRef]);

  const handleBackdropClick = () => {
    onClose();
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleSubmit = (payload: AddKidFormPayload) => {
    const newKid = buildKid(payload, existingKids, rooms);
    onAddKid(newKid);
    onClose();
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-kid-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-6 py-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <AddKidForm
          rooms={rooms}
          open={open}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>,
    document.body,
  );
};
