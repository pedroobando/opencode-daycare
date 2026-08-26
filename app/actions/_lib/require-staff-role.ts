import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CurrentStaffUser = {
  userId: string;
  daycareId: string;
  role: 'staff' | 'admin';
};

export const requireStaffOrAdmin = async (): Promise<CurrentStaffUser> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user.');
  }

  const { data } = await supabase
    .from('users')
    .select('id, daycare_id, role')
    .eq('id', user.id)
    .single();

  if (!data || (data.role !== 'staff' && data.role !== 'admin')) {
    throw new Error('No autorizado: se requiere rol staff o admin.');
  }

  return { userId: data.id, daycareId: data.daycare_id, role: data.role };
};
