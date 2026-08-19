'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidEmail } from '@/app/utils/email';

interface AuthLoginFormProps {
  defaultEmail: string;
}

export const AuthLoginForm = ({ defaultEmail }: AuthLoginFormProps) => {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setError('Ingresá un email válido.');
      return;
    }

    setError(null);
    router.push('/');
  };

  return (
    <div className="space-y-4">
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
          onChange={(event) => setEmail(event.target.value)}
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="w-full rounded-2xl border border-card-border bg-white px-4 py-3.5 text-foreground placeholder:text-placeholder-text"
        />
      </div>

      {error && (
        <p className="text-[12.5px] text-[#D9583C]">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-5 flex w-full items-center justify-center rounded-[15px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3.5 text-center text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
      >
        Iniciar sesión
      </button>
    </div>
  );
};
