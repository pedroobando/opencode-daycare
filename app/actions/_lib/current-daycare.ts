import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getCurrentUserDaycareId = async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from('users')
    .select('daycare_id')
    .eq('id', user.id)
    .single();

  return data?.daycare_id ?? null;
};

export const requireCurrentUserDaycareId = async (): Promise<string> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    throw new Error('No authenticated user with daycare_id');
  }
  return daycareId;
};
