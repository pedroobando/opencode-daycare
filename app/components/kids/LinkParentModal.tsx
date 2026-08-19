'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon, CloseIcon } from '@/app/components/icons';
import type { Parent } from '@/app/lib/kids';
import { pickNextColor } from '@/app/utils/avatar-colors';
import { generateAlphanumericCode } from '@/app/utils/random-code';
import { slugify } from '@/app/utils/slugify';
import {
  LinkParentForm,
  LinkParentFormPayload,
} from './LinkParentForm';

interface LinkParentModalProps {
  open: boolean;
  onClose: () => void;
  kidId: string;
  kidName: string;
  existingParents: Parent[];
  onAddParent: (parent: Parent) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const useMounted = (): boolean => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
};

export const LinkParentModal = ({
  open,
  onClose,
  kidName,
  existingParents,
  onAddParent,
  triggerRef,
}: LinkParentModalProps) => {
  const mounted = useMounted();
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const [invitationCode, setInvitationCode] = useState('');
  const wasOpenRef = useRef(false);

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
    if (open && !wasOpenRef.current) {
      setInvitationCode(generateAlphanumericCode(5));
    }

    wasOpenRef.current = open;
  }, [open]);

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

  const handleSubmit = (payload: LinkParentFormPayload) => {
    const trimmedName = payload.name.trim();
    const baseId = slugify(trimmedName);
    const alreadyUsed = existingParents.some((parent) => parent.id === baseId);

    const newParent: Parent = {
      id: `${baseId}${alreadyUsed ? `-${Date.now()}` : ''}`,
      name: trimmedName,
      role: payload.role,
      status: 'pending',
      initial: trimmedName.charAt(0).toUpperCase(),
      color: pickNextColor(existingParents, (parent) => parent.color),
    };

    onAddParent(newParent);
    onClose();
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-parent-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-6 py-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <div className="flex items-start justify-between border-b border-card-border px-6 py-5">
          <div>
            <h2
              id="link-parent-title"
              className="font-display text-[18px] font-semibold text-foreground"
            >
              Vincular padre
            </h2>
            <div className="text-[13px] text-muted-lighter">a {kidName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#F0E6D8] text-[#94887B]"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <div className="mb-5 flex gap-[11px] rounded-[14px] bg-[#E3ECFB] p-[13px_16px]">
            <AlertTriangleIcon className="mt-px h-5 w-5 flex-none text-[#4E72C8]" />
            <span className="text-[13.5px] leading-[1.45] text-[#3F5694]">
              Le enviaremos un correo con un código para que active su cuenta.
              Solo verá el feed de {kidName}.
            </span>
          </div>
        </div>

        <LinkParentForm
          open={open}
          invitationCode={invitationCode}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>,
    document.body,
  );
};
