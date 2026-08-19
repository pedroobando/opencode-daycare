import Link from 'next/link';

interface AuthPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { email } = await searchParams;

  return (
    <div className="w-full max-w-[392px]">
      <h2 className="font-display text-[30px] font-semibold text-foreground">
        Iniciar sesión
      </h2>
      <p className="mb-7 text-[15px] text-muted">
        Ingresá para ver el día de hoy.
      </p>

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
            defaultValue={email ?? ''}
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
      </div>

      <div className="mt-2.5 text-right">
        <Link
          href="#"
          className="text-[13.5px] font-bold text-accent-dark"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Link
        href="/"
        className="mt-5 flex w-full items-center justify-center rounded-[15px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end py-3.5 text-center text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
      >
        Iniciar sesión
      </Link>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Te invitó la guardería?{' '}
        <Link href="/auth/active" className="font-extrabold text-accent-dark">
          Activá tu cuenta
        </Link>
      </p>
    </div>
  );
}
