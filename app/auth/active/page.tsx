'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, LogoIcon } from '@/app/components/icons';
import { isValidEmail } from '@/app/utils/email';

export default function AuthActivePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [email, setEmail] = useState('lucia.fernandez@gmail.com');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleActivate = () => {
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Ingresá un email válido.');
      return;
    }

    setEmailError(null);
    router.push(`/auth?email=${encodeURIComponent(trimmedEmail)}`);
  };

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

      <div className="space-y-4">
        <div>
          <label
            htmlFor="invitation-code"
            className="mb-2 block text-xs font-bold tracking-widest text-muted"
          >
            CÓDIGO DE INVITACIÓN
          </label>
          <input
            id="invitation-code"
            name="invitation-code"
            type="text"
            defaultValue="7K4P9"
            className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 font-display text-lg font-bold tracking-widest text-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-bold tracking-widest text-muted"
          >
            EMAIL
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(null);
            }}
            className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground"
          />
          {emailError && (
            <p className="mt-1 text-[12.5px] text-[#D9583C]">{emailError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-xs font-bold tracking-widest text-muted"
          >
            CREAR CONTRASEÑA
          </label>
          <input
            id="password"
            name="password"
            type="password"
            defaultValue="contraseña"
            className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground"
          />
        </div>
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={isAuthorized}
        onClick={() => setIsAuthorized((previous) => !previous)}
        className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#FBF1D6] p-4 text-left"
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
        type="button"
        onClick={handleActivate}
        className="mt-6 flex w-full items-center justify-center rounded-[15px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3.5 text-center text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
      >
        Activar mi cuenta
      </button>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link href="/auth" className="font-extrabold text-accent-dark">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
