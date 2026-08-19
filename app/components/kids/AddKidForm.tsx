'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@/app/components/icons';
import type { Room } from '@/app/lib/kids';

export interface AddKidFormPayload {
  fullName: string;
  birthDate: Date;
  roomId: string;
  allergies: string;
}

interface AddKidFormProps {
  rooms: Room[];
  open: boolean;
  onCancel: () => void;
  onSubmit: (payload: AddKidFormPayload) => void;
}

interface FormErrors {
  fullName?: string;
  birthDate?: string;
  roomId?: string;
}

/**
 * Formats raw digits into a dd/mm/aaaa string while the user types.
 * Non-numeric characters are stripped and the result is capped at 10 chars.
 */
export const formatDateInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/**
 * Parses a dd/mm/aaaa string into a local Date.
 * Returns null if the value is incomplete, contains non-numeric parts,
 * represents an invalid date (for example 31/02/2024), or is in the future.
 */
export const parseDateInput = (value: string): Date | null => {
  if (value.length !== 10) {
    return null;
  }

  const [dayPart, monthPart, yearPart] = value.split('/');

  if (!dayPart || !monthPart || !yearPart) {
    return null;
  }

  const day = parseInt(dayPart, 10);
  const month = parseInt(monthPart, 10);
  const year = parseInt(yearPart, 10);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date.getTime() > today.getTime()) {
    return null;
  }

  return date;
};

export const AddKidForm = ({
  rooms,
  open,
  onCancel,
  onSubmit,
}: AddKidFormProps) => {
  const [fullName, setFullName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setFullName('');
      setBirthDateInput('');
      setSelectedRoomId('');
      setAllergies('');
      setMedicalNotes('');
      setErrors({});
    }
  }, [open]);

  const handleBirthDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBirthDateInput(formatDateInput(event.target.value));
  };

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};
    const trimmedFullName = fullName.trim();

    if (trimmedFullName === '') {
      nextErrors.fullName = 'Este campo es obligatorio.';
    }

    const parsedBirthDate = parseDateInput(birthDateInput);

    if (parsedBirthDate === null) {
      nextErrors.birthDate = 'Este campo es obligatorio.';
    }

    if (selectedRoomId === '') {
      nextErrors.roomId = 'Este campo es obligatorio.';
    }

    setErrors(nextErrors);

    if (
      trimmedFullName === '' ||
      parsedBirthDate === null ||
      selectedRoomId === ''
    ) {
      return;
    }

    onSubmit({
      fullName: trimmedFullName,
      birthDate: parsedBirthDate,
      roomId: selectedRoomId,
      allergies: allergies.trim(),
    });
  };

  const inputBaseClasses =
    'w-full rounded-[14px] border border-card-border bg-card px-4 py-[13px] text-[15px] text-foreground outline-none placeholder:text-placeholder-text';

  const labelClasses =
    'mb-2 block text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light';

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]">
      <div className="flex items-center justify-between border-b border-card-border px-6 py-5">
        <button
          type="button"
          onClick={onCancel}
          className="text-[15px] font-bold text-muted-light"
        >
          Cancelar
        </button>
        <h2
          id="add-kid-title"
          className="font-display text-[18px] font-semibold text-foreground"
        >
          Agregar niño
        </h2>
        <button
          type="button"
          onClick={handleSubmit}
          className="text-[15px] font-extrabold text-primary"
        >
          Guardar
        </button>
      </div>

      <div className="px-6 py-6">
        <div aria-live="polite" className="sr-only">
          {Object.values(errors).some(Boolean) && 'Hay errores en el formulario.'}
        </div>

        <div className="mb-[18px]">
          <label htmlFor="full-name" className={labelClasses}>
            Nombre completo
          </label>
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ej. Martina López"
            aria-invalid={errors.fullName ? 'true' : 'false'}
            aria-describedby={errors.fullName ? 'full-name-error' : undefined}
            className={inputBaseClasses}
          />
          {errors.fullName && (
            <p id="full-name-error" className="mt-1 text-[12.5px] text-[#D9583C]">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="mb-[18px] flex gap-14">
          <div className="flex-1">
            <label htmlFor="birth-date" className={labelClasses}>
              Fecha de nacimiento
            </label>
            <input
              id="birth-date"
              type="text"
              inputMode="numeric"
              value={birthDateInput}
              onChange={handleBirthDateChange}
              placeholder="dd/mm/aaaa"
              aria-invalid={errors.birthDate ? 'true' : 'false'}
              aria-describedby={
                errors.birthDate ? 'birth-date-error' : undefined
              }
              className={inputBaseClasses}
            />
            {errors.birthDate && (
              <p
                id="birth-date-error"
                className="mt-1 text-[12.5px] text-[#D9583C]"
              >
                {errors.birthDate}
              </p>
            )}
          </div>

          <div className="flex-1">
            <label htmlFor="room" className={labelClasses}>
              Sala
            </label>
            <div className="relative">
              <select
                id="room"
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
                aria-invalid={errors.roomId ? 'true' : 'false'}
                aria-describedby={errors.roomId ? 'room-error' : undefined}
                className={`${inputBaseClasses} appearance-none pr-10`}
              >
                <option value="" disabled>
                  Seleccionar
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder-text" />
            </div>
            {errors.roomId && (
              <p id="room-error" className="mt-1 text-[12.5px] text-[#D9583C]">
                {errors.roomId}
              </p>
            )}
          </div>
        </div>

        <div className="mb-[18px]">
          <label htmlFor="allergies" className={labelClasses}>
            Alergias (etiquetas)
          </label>
          <input
            id="allergies"
            type="text"
            value={allergies}
            onChange={(event) => setAllergies(event.target.value)}
            placeholder="Ej. Maní, Lactosa"
            className={inputBaseClasses}
          />
        </div>

        <div>
          <label htmlFor="medical-notes" className={labelClasses}>
            Notas médicas
          </label>
          <textarea
            id="medical-notes"
            value={medicalNotes}
            onChange={(event) => setMedicalNotes(event.target.value)}
            placeholder="Indicaciones, medicación, contactos..."
            rows={4}
            className={`${inputBaseClasses} min-h-[90px] resize-y leading-relaxed`}
          />
        </div>
      </div>
    </div>
  );
};
