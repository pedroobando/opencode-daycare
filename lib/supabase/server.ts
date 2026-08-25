import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createSupabaseServerClient = async () => {
  if (!SUPABASE_URL) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have a proxy refreshing user sessions.
        }
      },
    },
  });
};
