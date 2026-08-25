'use client';

import { useEffect, useRef, useSyncExternalStore, useActionState } from 'react';
import { createPortal } from 'react-dom';
import { AddKidForm } from '@/app/components/kids/AddKidForm';
import type { RoomRow } from '@/app/actions/rooms';
import { createChild } from '@/app/actions/children';
import type { CreateChildState } from '@/app/actions/children';

interface AddKidModalProps {
  open: boolean;
  onClose: () => void;
  rooms: RoomRow[];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const useMounted = (): boolean => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
};

const INITIAL_STATE: CreateChildState = { error: null };

export const AddKidModal = ({
  open,
  onClose,
  rooms,
  triggerRef,
}: AddKidModalProps) => {
  const mounted = useMounted();
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const submitAttemptedRef = useRef(false);

  const [state, formAction] = useActionState(createChild, INITIAL_STATE);

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
    if (state.error === null && submitAttemptedRef.current) {
      submitAttemptedRef.current = false;
      onClose();
    }
  }, [state, onClose]);

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
          formAction={formAction}
          state={state}
          onSubmitAttempted={handleSubmitAttempted}
        />
      </div>
    </div>,
    document.body,
  );
};
