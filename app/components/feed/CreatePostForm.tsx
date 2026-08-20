'use client';

import { useState } from 'react';
import { PlusIcon, ImagePlaceholderIcon } from '@/app/components/icons';
import type { Kid } from '@/app/lib/kids';
import { getAvatarTextColor } from '@/app/lib/kids';
import type { PostType } from '@/app/lib/posts';

export interface CreatePostFormPayload {
  selectedKidIds: Set<string>;
  isAllRoom: boolean;
  selectedType: PostType;
  description: string;
  photoCount: number;
}

interface CreatePostFormProps {
  open: boolean;
  kids: Kid[];
  onCancel: () => void;
  onSubmit: (payload: CreatePostFormPayload) => void;
}

interface FormErrors {
  recipients?: string;
  type?: string;
  description?: string;
}

const TYPE_OPTIONS: { type: PostType; label: string }[] = [
  { type: 'meal', label: 'Comida' },
  { type: 'nap', label: 'Siesta' },
  { type: 'activity', label: 'Actividad' },
  { type: 'achievement', label: 'Logro' },
  { type: 'mood', label: 'Ánimo' },
  { type: 'photo', label: 'Foto' },
  { type: 'announcement', label: 'Anuncio' },
];

const TYPE_COLORS: Record<
  PostType,
  { bgClass: string; textClass: string }
> = {
  meal: { bgClass: 'bg-meal-bg', textClass: 'text-meal-text' },
  nap: { bgClass: 'bg-nap-bg', textClass: 'text-nap-text' },
  activity: { bgClass: 'bg-activity-bg', textClass: 'text-activity-text' },
  achievement: { bgClass: 'bg-achievement-bg', textClass: 'text-achievement-text' },
  mood: { bgClass: 'bg-mood-bg', textClass: 'text-mood-text' },
  photo: { bgClass: 'bg-photo-bg', textClass: 'text-photo-text' },
  announcement: { bgClass: 'bg-announcement-bg', textClass: 'text-announcement-text' },
};

const SECTION_LABEL_CLASSES =
  'mb-2.5 block text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light';

const ERROR_TEXT_CLASSES = 'mt-1.5 text-[12.5px] text-[#D9583C]';

export const CreatePostForm = ({
  open,
  kids,
  onSubmit,
}: CreatePostFormProps) => {
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
  const [isAllRoom, setIsAllRoom] = useState(false);
  const [selectedType, setSelectedType] = useState<PostType | null>(null);
  const [description, setDescription] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});

  if (!open) {
    return null;
  }

  const allKidsSelected = selectedKidIds.size === kids.length && kids.length > 0;
  const showAllRoomHighlight = isAllRoom || allKidsSelected;

  const handleAllRoomClick = () => {
    if (isAllRoom) {
      setIsAllRoom(false);
      setSelectedKidIds(new Set());
    } else {
      setIsAllRoom(true);
      setSelectedKidIds(new Set(kids.map((kid) => kid.id)));
    }
  };

  const handleKidClick = (id: string) => {
    const nextSelectedKidIds = new Set(selectedKidIds);

    if (isAllRoom) {
      setIsAllRoom(false);
    }

    if (nextSelectedKidIds.has(id)) {
      nextSelectedKidIds.delete(id);
    } else {
      nextSelectedKidIds.add(id);
    }

    setSelectedKidIds(nextSelectedKidIds);
  };

  const handleTypeClick = (type: PostType) => {
    setSelectedType(type);
  };

  const handleAddPhotoClick = () => {
    setPhotoCount((previous) => previous + 1);
  };

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};

    if (selectedKidIds.size === 0 && !isAllRoom) {
      nextErrors.recipients = 'Seleccioná al menos un destinatario.';
    }

    if (selectedType === null) {
      nextErrors.type = 'Seleccioná un tipo.';
    }

    if (description.trim() === '') {
      nextErrors.description = 'Este campo es obligatorio.';
    }

    setErrors(nextErrors);

    if (
      (selectedKidIds.size === 0 && !isAllRoom) ||
      selectedType === null ||
      description.trim() === ''
    ) {
      return;
    }

    onSubmit({
      selectedKidIds,
      isAllRoom,
      selectedType,
      description: description.trim(),
      photoCount,
    });
  };

  const isKidActive = (id: string) => {
    return showAllRoomHighlight || selectedKidIds.has(id);
  };

  return (
    <form
      id="create-post-form"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="px-5 py-5"
    >
      <div aria-live="polite" className="sr-only">
        {Object.values(errors).some(Boolean) && 'Hay errores en el formulario.'}
      </div>

      <div
        className="mb-4"
        aria-invalid={errors.recipients ? 'true' : 'false'}
      >
        <span className={SECTION_LABEL_CLASSES}>Para</span>
        <div className="flex flex-wrap gap-2">
          {kids.map((kid) => {
            const active = isKidActive(kid.id);

            return (
              <button
                key={kid.id}
                type="button"
                onClick={() => handleKidClick(kid.id)}
                className={`flex items-center gap-2 rounded-full border-[1.5px] py-[5px] pl-[5px] pr-3.5 text-[14px] font-bold transition-colors ${
                  active
                    ? 'border-foreground bg-foreground text-white'
                    : 'border-card-border bg-card text-muted-light'
                }`}
              >
                <span
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full font-display text-[13px] font-semibold"
                  style={{
                    backgroundColor: kid.color,
                    color: getAvatarTextColor(kid.color),
                  }}
                >
                  {kid.initial}
                </span>
                <span>{kid.firstName}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleAllRoomClick}
            className={`rounded-full border-[1.5px] px-4 py-[7px] text-[14px] font-bold transition-colors ${
              showAllRoomHighlight
                ? 'border-card-border bg-card text-foreground'
                : 'border-card-border bg-card text-muted-light'
            }`}
          >
            Toda la sala
          </button>
        </div>
        {errors.recipients && (
          <p className={ERROR_TEXT_CLASSES}>{errors.recipients}</p>
        )}
      </div>

      <div className="mb-4" aria-invalid={errors.type ? 'true' : 'false'}>
        <span className={SECTION_LABEL_CLASSES}>Tipo</span>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => {
            const active = selectedType === option.type;
            const { bgClass, textClass } = TYPE_COLORS[option.type];

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => handleTypeClick(option.type)}
                className={`rounded-full px-4 py-2 text-[13.5px] font-extrabold transition-opacity ${
                  active
                    ? `border-none ${bgClass} ${textClass}`
                    : `border-none ${bgClass} ${textClass} opacity-60`
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.type && <p className={ERROR_TEXT_CLASSES}>{errors.type}</p>}
      </div>

      <div className="mb-4" aria-invalid={errors.description ? 'true' : 'false'}>
        <label htmlFor="post-description" className={SECTION_LABEL_CLASSES}>
          Descripción
        </label>
        <textarea
          id="post-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Contá cómo le fue hoy…"
          className="min-h-[120px] w-full resize-y rounded-[14px] border border-card-border bg-card px-4 py-[14px] text-[15px] text-foreground outline-none placeholder:text-placeholder-text"
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        {errors.description && (
          <p id="description-error" className={ERROR_TEXT_CLASSES}>
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <span className={SECTION_LABEL_CLASSES}>Fotos</span>
        <div className="flex gap-3">
          <div className="flex h-24 w-24 flex-none items-center justify-center rounded-[14px] border border-card-border bg-placeholder-bg text-placeholder-text">
            <ImagePlaceholderIcon className="h-[26px] w-[26px]" />
          </div>

          <button
            type="button"
            onClick={handleAddPhotoClick}
            className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-placeholder-border bg-placeholder-bg text-placeholder-text"
          >
            <PlusIcon className="h-[22px] w-[22px] text-accent-dark" />
            <span className="text-[12px]">Agregar</span>
          </button>

          {Array.from({ length: photoCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={handleAddPhotoClick}
              className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-placeholder-border bg-placeholder-bg text-placeholder-text"
            >
              <PlusIcon className="h-[22px] w-[22px] text-accent-dark" />
              <span className="text-[12px]">Agregar</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};
