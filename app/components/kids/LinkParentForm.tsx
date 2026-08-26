'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { SendIcon } from '@/app/components/icons';
import { isValidEmail } from '@/app/utils/email';
import type { CreateInvitationState } from '@/app/actions/invitations';

interface LinkParentFormProps {
  kidId: string;
  open: boolean;
  formAction: (payload: FormData) => void;
  state: CreateInvitationState;
  onCancel: () => void;
  onSubmitAttempted: () => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
}

const ROLE_OPTIONS = [
  { label: 'Mamá', value: 'mother' },
  { label: 'Papá', value: 'father' },
  { label: 'Tutor/a', value: 'guardian' },
] as const;

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-gradient-to-b from-[#F4977E] to-[#EE8164] py-[11px] text-center text-[15.5px] font-extrabold text-white disabled:opacity-60"
    >
      <SendIcon className="h-[18px] w-[18px]" />
      {pending ? 'Enviando…' : 'Enviar invitación'}
    </button>
  );
};

export const LinkParentForm = ({
  kidId,
  open,
  formAction,
  state,
  onCancel,
  onSubmitAttempted,
}: LinkParentFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});

  if (!open) {
    return null;
  }

  const handleValidateBefore = (event: React.FormEvent<HTMLFormElement>) => {
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

    if (trimmedName === '' || trimmedEmail === '' || !isValidEmail(trimmedEmail) || role === '') {
      event.preventDefault();
      return;
    }

    onSubmitAttempted();
  };

  const inputBaseClasses =
    'w-full rounded-[14px] border border-card-border bg-card px-4 py-[11px] text-[15px] text-foreground outline-none placeholder:text-placeholder-text';

  const labelClasses =
    'mb-2 block text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light';

  return (
    <form action={formAction} onSubmit={handleValidateBefore}>
      <input type="hidden" name="child_id" value={kidId} />
      <input type="hidden" name="relationship" value={role} />

      <div className="px-5 pb-5">
        <div aria-live="polite" className="sr-only">
          {Object.values(errors).some(Boolean) && 'Hay errores en el formulario.'}
        </div>

        {state.error !== null && (
          <p className="mb-3 text-[12.5px] text-[#D9583C]">{state.error}</p>
        )}

        <div className="mb-3">
          <label htmlFor="parent-name" className={labelClasses}>
            Nombre del padre/madre
          </label>
          <input
            id="parent-name"
            name="full_name"
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

        <div className="mb-3">
          <label htmlFor="parent-email" className={labelClasses}>
            Email
          </label>
          <input
            id="parent-email"
            name="email"
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

        <div className="mb-3">
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
              const isSelected = role === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setRole(option.value)}
                  className={`flex-1 rounded-[14px] py-[10px] text-center text-[15px] font-extrabold transition-colors ${
                    isSelected
                      ? 'border-[1.5px] border-[#9FB8EC] bg-[#CCD8F4] text-[#4E72C8]'
                      : 'border-[1.5px] border-card-border bg-[#FFFDF9] text-muted-light'
                  }`}
                >
                  {option.label}
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

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[15px] border-[1.5px] border-card-border bg-[#FFFDF9] py-[11px] text-center text-[15.5px] font-extrabold text-muted-light transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <div className="flex-[2]">
            <SubmitButton />
          </div>
        </div>
      </div>
    </form>
  );
};
