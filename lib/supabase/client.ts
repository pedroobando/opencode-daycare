import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createSupabaseBrowserClient = () => {
  if (!SUPABASE_URL) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
};
