'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn } from '@/app/actions/auth';

interface AuthLoginFormProps {
  defaultEmail: string;
}

const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 flex w-full items-center justify-center rounded-[15px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3.5 text-center text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Ingresando...' : 'Iniciar sesión'}
    </button>
  );
};

export const AuthLoginForm = ({ defaultEmail }: AuthLoginFormProps) => {
  const [state, formAction] = useActionState(signIn, { error: null });

  return (
    <form action={formAction} className="space-y-4">
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
          defaultValue={defaultEmail}
          placeholder="ej. nombre@opendaycare.com"
          className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground placeholder:text-placeholder-text"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-xs font-bold tracking-widest text-muted"
        >
          CONTRASEÑA
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground placeholder:text-placeholder-text"
        />
      </div>

      {state.error && (
        <p className="text-[12.5px] text-[#D9583C]">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
};
