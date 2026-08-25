import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthLoginForm } from '@/app/components/auth/AuthLoginForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface AuthPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  const { email } = await searchParams;

  return (
    <div className="w-full max-w-[392px]">
      <h2 className="font-display text-[30px] font-semibold text-foreground">
        Iniciar sesión
      </h2>
      <p className="mb-7 text-[15px] text-muted">
        Ingresá para ver el día de hoy.
      </p>

      <AuthLoginForm defaultEmail={email ?? ''} />

      <div className="mt-2.5 text-right">
        <Link
          href="#"
          className="text-[13.5px] font-bold text-accent-dark"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Te invitó la guardería?{' '}
        <Link href="/auth/active" className="font-extrabold text-accent-dark">
          Activá tu cuenta
        </Link>
      </p>
    </div>
  );
}
