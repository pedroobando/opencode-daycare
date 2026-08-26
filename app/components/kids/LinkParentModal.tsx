'use client';

import { useEffect, useRef, useActionState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon, CloseIcon } from '@/app/components/icons';
import { createInvitation } from '@/app/actions/invitations';
import type { CreateInvitationState } from '@/app/actions/invitations';
import { LinkParentForm } from './LinkParentForm';

interface LinkParentModalProps {
  open: boolean;
  onClose: () => void;
  kidId: string;
  kidName: string;
  onSuccess: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const useMounted = (): boolean => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
};

const INITIAL_STATE: CreateInvitationState = { error: null };

export const LinkParentModal = ({
  open,
  onClose,
  kidId,
  kidName,
  onSuccess,
  triggerRef,
}: LinkParentModalProps) => {
  const mounted = useMounted();
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const submitAttemptedRef = useRef(false);

  const [state, formAction] = useActionState(createInvitation, INITIAL_STATE);

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

  useEffect(() => {
    if (state.error !== null || !submitAttemptedRef.current) {
      return;
    }

    submitAttemptedRef.current = false;
    onSuccess();
    onClose();
  }, [state, onSuccess, onClose]);

  const handleBackdropClick = () => {
    onClose();
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleSubmitAttempted = () => {
    submitAttemptedRef.current = true;
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-parent-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6"
      onClick={handleBackdropClick}
    >
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <div className="flex items-start justify-between border-b border-card-border px-5 py-4">
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

        <div className="px-5 pt-4">
          <div className="mb-4 flex gap-[11px] rounded-[14px] bg-[#E3ECFB] p-3 px-4">
            <AlertTriangleIcon className="mt-px h-5 w-5 flex-none text-[#4E72C8]" />
            <span className="text-[13.5px] leading-[1.45] text-[#3F5694]">
              Le enviaremos un correo con un código para que active su cuenta.
              Solo verá el feed de {kidName}.
            </span>
          </div>
        </div>

        <LinkParentForm
          kidId={kidId}
          open={open}
          formAction={formAction}
          state={state}
          onCancel={onClose}
          onSubmitAttempted={handleSubmitAttempted}
        />
      </div>
    </div>,
    document.body,
  );
};
