'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  CreatePostForm,
  CreatePostFormPayload,
} from '@/app/components/feed/CreatePostForm';
import type { Kid } from '@/app/lib/kids';
import type { Post } from '@/app/lib/posts';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  allKids: Kid[];
  onAddPost: (post: Post) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const useMounted = (): boolean => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
};

export const CreatePostModal = ({
  open,
  onClose,
  allKids,
  onAddPost,
  triggerRef,
}: CreatePostModalProps) => {
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

    const firstInput = cardRef.current.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input, select, textarea');

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

  const handleSubmit = (payload: CreatePostFormPayload) => {
    const now = new Date();
    const time = new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const kidsById = Object.fromEntries(
      allKids.map((kid) => [kid.id, kid]),
    ) as Record<string, Kid>;

    const allKidsSelected =
      payload.selectedKidIds.size === allKids.length && allKids.length > 0;

    const recipientLabel = (() => {
      if (payload.isAllRoom || allKidsSelected) {
        return 'toda la sala';
      }

      const names = [...payload.selectedKidIds]
        .map((id) => kidsById[id]?.firstName)
        .filter((name): name is string => typeof name === 'string')
        .sort((a, b) => a.localeCompare(b, 'es'));

      if (names.length === 0) {
        return '';
      }

      if (names.length === 1) {
        return `familia de ${names[0]}`;
      }

      if (names.length === 2) {
        return `familia de ${names[0]} y ${names[1]}`;
      }

      return `familia de ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    })();

    const author = (() => {
      if (payload.selectedType === 'announcement') {
        return { name: 'Anuncio general', initial: '', color: '#CCD8F4' };
      }

      if (payload.isAllRoom) {
        return { name: 'Caro Giménez', initial: 'C', color: '#F2937A' };
      }

      const firstId = [...payload.selectedKidIds][0];
      const firstKid = kidsById[firstId];

      return {
        name: firstKid.firstName,
        initial: firstKid.initial,
        color: firstKid.color,
      };
    })();

    const newPost: Post = {
      id: `post-${Date.now()}`,
      type: payload.selectedType,
      author,
      recipientLabel,
      content: payload.description,
      time,
      publishedBy: 'publicado por vos',
      likes: 0,
      comments: 0,
      photos: payload.photoCount > 0 ? payload.photoCount : undefined,
    };

    onAddPost(newPost);
    onClose();
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-6 py-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-card-border px-5 py-5">
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-bold text-muted-light"
          >
            Cancelar
          </button>
          <h2
            id="create-post-title"
            className="font-display text-[18px] font-semibold text-foreground"
          >
            Nueva publicación
          </h2>
          <button
            type="submit"
            form="create-post-form"
            className="text-[15px] font-extrabold text-primary"
          >
            Publicar
          </button>
        </div>

        <CreatePostForm
          open={open}
          kids={allKids}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>,
    document.body,
  );
};
