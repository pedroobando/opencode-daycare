'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckIcon, LogoIcon } from '@/app/components/icons';
import { isValidEmail } from '@/app/utils/email';
import { activateInvitation, type ActivateInvitationState } from '@/app/actions/auth';

const INITIAL_STATE: ActivateInvitationState = { error: null };
const MIN_PASSWORD_LENGTH = 8;
const MIN_FULL_NAME_LENGTH = 2;

export const AuthActiveBody = () => {
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(activateInvitation, INITIAL_STATE);
  const [code, setCode] = useState(() =>
    (searchParams?.get('code') ?? '').toUpperCase(),
  );
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errors, setErrors] = useState<{
    code?: string;
    email?: string;
    fullName?: string;
    password?: string;
  }>({});

  const handleValidateBefore = (event: React.FormEvent<HTMLFormElement>) => {
    const nextErrors: {
      code?: string;
      email?: string;
      fullName?: string;
      password?: string;
    } = {};
    const trimmedCode = code.trim();
    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();

    if (trimmedCode === '') {
      nextErrors.code = 'Ingresá el código de invitación.';
    }
    if (trimmedFullName.length < MIN_FULL_NAME_LENGTH) {
      nextErrors.fullName = 'Ingresá tu nombre.';
    }
    if (!isValidEmail(trimmedEmail)) {
      nextErrors.email = 'Ingresá un email válido.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }

    setErrors(nextErrors);

    if (
      trimmedCode === '' ||
      trimmedFullName.length < MIN_FULL_NAME_LENGTH ||
      !isValidEmail(trimmedEmail) ||
      password.length < MIN_PASSWORD_LENGTH
    ) {
      event.preventDefault();
    }
  };

  const inputBaseClasses =
    'w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground outline-none placeholder:text-placeholder-text';

  const labelClasses =
    'mb-2 block text-xs font-bold tracking-widest text-muted';

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-6 flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#F8C3A8] to-[#F2937A] shadow-[0_12px_26px_-10px_rgba(238,129,100,0.65)]">
        <LogoIcon className="h-[30px] w-[30px] text-white" />
      </div>

      <h1 className="font-display text-[32px] font-semibold leading-[1.15] text-foreground">
        Bienvenida a OpenDayCare
      </h1>
      <p className="mb-6 text-[15.5px] leading-relaxed text-muted">
        Te invitaron a seguir el día de tu hijo. Creá tu contraseña para
        activar la cuenta.
      </p>

      <div className="mb-6 flex items-center gap-3.5 rounded-2xl border border-card-border bg-white p-3.5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-avatar-blue font-display text-[19px] font-semibold text-[#1F7A93]">
          M
        </div>
        <div>
          <div className="text-[13px] text-muted">Te invitaron a seguir a</div>
          <div className="font-display text-[17px] font-semibold text-foreground">
            Mateo · Sala Soles
          </div>
        </div>
      </div>

      <form action={formAction} onSubmit={handleValidateBefore} className="space-y-4">
        <div aria-live="polite" className="sr-only">
          {Object.values(errors).some(Boolean) && 'Hay errores en el formulario.'}
        </div>

        {state.error !== null && (
          <p className="text-[12.5px] text-[#D9583C]">{state.error}</p>
        )}

        <div>
          <label htmlFor="code" className={labelClasses}>
            CÓDIGO DE INVITACIÓN
          </label>
          <input
            id="code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setErrors((previous) => ({ ...previous, code: undefined }));
            }}
            aria-invalid={errors.code ? 'true' : 'false'}
            aria-describedby={errors.code ? 'code-error' : undefined}
            className={`${inputBaseClasses} font-display text-lg font-bold tracking-widest text-foreground`}
          />
          {errors.code && (
            <p id="code-error" className="mt-1 text-[12.5px] text-[#D9583C]">
              {errors.code}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="full_name" className={labelClasses}>
            TU NOMBRE
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setErrors((previous) => ({ ...previous, fullName: undefined }));
            }}
            placeholder="Ej. Lucía Fernández"
            aria-invalid={errors.fullName ? 'true' : 'false'}
            aria-describedby={errors.fullName ? 'full_name-error' : undefined}
            className={inputBaseClasses}
          />
          {errors.fullName && (
            <p id="full_name-error" className="mt-1 text-[12.5px] text-[#D9583C]">
              {errors.fullName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClasses}>
            EMAIL
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((previous) => ({ ...previous, email: undefined }));
            }}
            placeholder="correo@ejemplo.com"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={inputBaseClasses}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-[12.5px] text-[#D9583C]">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={labelClasses}>
            CREAR CONTRASEÑA
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((previous) => ({ ...previous, password: undefined }));
            }}
            placeholder="Mínimo 8 caracteres"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={inputBaseClasses}
          />
          {errors.password && (
            <p id="password-error" className="mt-1 text-[12.5px] text-[#D9583C]">
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={isAuthorized}
          onClick={() => setIsAuthorized((previous) => !previous)}
          className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#FBF1D6] p-4 text-left"
        >
          <span
            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 border-[#5FB97E] ${
              isAuthorized ? 'bg-[#5FB97E]' : 'bg-transparent'
            }`}
          >
            {isAuthorized && <CheckIcon className="h-4 w-4 text-white" />}
          </span>
          <span className="text-sm leading-snug text-[#8A7234]">
            Autorizo a la guardería a tomar y compartir fotos de mi hijo dentro de
            la app.
          </span>
        </button>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-[15px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3.5 text-center text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
        >
          Activar mi cuenta
        </button>
      </form>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link href="/auth" className="font-extrabold text-accent-dark">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
};
