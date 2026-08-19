'use client';

import { useState } from 'react';
import { SendIcon } from '@/app/components/icons';
import { isValidEmail } from '@/app/utils/email';

export interface LinkParentFormPayload {
  name: string;
  email: string;
  role: string;
}

interface LinkParentFormProps {
  open: boolean;
  invitationCode: string;
  onCancel: () => void;
  onSubmit: (payload: LinkParentFormPayload) => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
}

const ROLE_OPTIONS = ['Mamá', 'Papá', 'Tutor/a'] as const;

export const LinkParentForm = ({
  open,
  invitationCode,
  onSubmit,
}: LinkParentFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName === '') {
      nextErrors.name = 'Este campo es obligatorio.';
    }

    if (trimmedEmail === '' || !isValidEmail(trimmedEmail)) {
      nextErrors.email = 'Ingresá un email válido.';
    }

    if (role === '') {
      nextErrors.role = 'Este campo es obligatorio.';
    }

    setErrors(nextErrors);

    if (
      trimmedName === '' ||
      trimmedEmail === '' ||
      !isValidEmail(trimmedEmail) ||
      role === ''
    ) {
      return;
    }

    onSubmit({
      name: trimmedName,
      email: trimmedEmail,
      role,
    });
  };

  const inputBaseClasses =
    'w-full rounded-[14px] border border-card-border bg-card px-4 py-[13px] text-[15px] text-foreground outline-none placeholder:text-placeholder-text';

  const labelClasses =
    'mb-2 block text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light';

  return (
    <div className="px-6 py-6">
      <div aria-live="polite" className="sr-only">
        {Object.values(errors).some(Boolean) && 'Hay errores en el formulario.'}
      </div>

      <div className="mb-[18px]">
        <label htmlFor="parent-name" className={labelClasses}>
          Nombre del padre/madre
        </label>
        <input
          id="parent-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Diego Fernández"
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'parent-name-error' : undefined}
          className={inputBaseClasses}
        />
        {errors.name && (
          <p id="parent-name-error" className="mt-1 text-[12.5px] text-[#D9583C]">
            {errors.name}
          </p>
        )}
      </div>

      <div className="mb-[18px]">
        <label htmlFor="parent-email" className={labelClasses}>
          Email
        </label>
        <input
          id="parent-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="correo@ejemplo.com"
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'parent-email-error' : undefined}
          className={inputBaseClasses}
        />
        {errors.email && (
          <p
            id="parent-email-error"
            className="mt-1 text-[12.5px] text-[#D9583C]"
          >
            {errors.email}
          </p>
        )}
      </div>

      <div className="mb-[18px]">
        <div
          className={labelClasses}
          id="parent-role-label"
          aria-invalid={errors.role ? 'true' : 'false'}
        >
          Parentesco
        </div>
        <div
          role="radiogroup"
          aria-labelledby="parent-role-label"
          aria-describedby={errors.role ? 'parent-role-error' : undefined}
          className="flex gap-9"
        >
          {ROLE_OPTIONS.map((option) => {
            const isSelected = role === option;

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setRole(option)}
                className={`flex-1 rounded-[14px] py-[13px] text-center text-[15px] font-extrabold transition-colors ${
                  isSelected
                    ? 'border-[1.5px] border-[#9FB8EC] bg-[#CCD8F4] text-[#4E72C8]'
                    : 'border-[1.5px] border-card-border bg-[#FFFDF9] text-muted-light'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {errors.role && (
          <p id="parent-role-error" className="mt-1 text-[12.5px] text-[#D9583C]">
            {errors.role}
          </p>
        )}
      </div>

      <div className="mb-[18px] rounded-[14px] border-[1.5px] border-dashed border-[#E6D08A] bg-[#FBF1D6] p-[18px] text-center">
        <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.7px] text-[#A88526]">
          Código de invitación
        </div>
        <div className="font-display text-[34px] font-semibold tracking-[7px] text-[#8A7234]">
          {invitationCode}
        </div>
        <div className="mt-1.5 text-[13px] text-[#A88526]">Vence en 7 días</div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-gradient-to-b from-[#F4977E] to-[#EE8164] py-[13px] text-center text-[15.5px] font-extrabold text-white"
      >
        <SendIcon className="h-[18px] w-[18px]" />
        Enviar invitación
      </button>
    </div>
  );
};
