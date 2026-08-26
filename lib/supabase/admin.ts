import 'server-only';

// Service-role client. Bypasses RLS and is intended for server-only reads that
// the user's session cannot perform (e.g. resolving an invitation's
// `daycare_id` before the parent signs up and gets a JWT).
//
// This client MUST stay on the server. Never import it from a client component
// or expose `SUPABASE_SERVICE_ROLE_KEY` via a `NEXT_PUBLIC_*` env var.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createSupabaseAdminClient = () => {
  if (!SUPABASE_URL) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
