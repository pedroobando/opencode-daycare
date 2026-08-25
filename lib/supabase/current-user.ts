import type { Database } from '@/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SidebarUser = {
  fullName: string;
  initial: string;
  roleLabel: string;
  daycareName: string;
  avatarColorClass: string;
};

export type UserRole = Database['public']['Enums']['user_role'];

export const ROLE_LABEL: Record<UserRole, string> = {
  staff: 'Personal',
  parent: 'Familia',
  admin: 'Administración',
};

export const AVATAR_PALETTE = [
  'bg-avatar-coral',
  'bg-avatar-blue',
  'bg-avatar-indigo',
] as const;

const computeAvatarColorClass = (fullName: string): string => {
  const hash = fullName
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

export const getCurrentUser = async (): Promise<SidebarUser | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('full_name, role, daycares(name)')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    const fullName = data.full_name;
    const initial = fullName.trim().charAt(0).toUpperCase() || '?';
    const roleLabel = ROLE_LABEL[data.role];
    const daycareName = data.daycares?.name ?? 'Sala desconocida';
    const avatarColorClass = computeAvatarColorClass(fullName);

    return {
      fullName,
      initial,
      roleLabel,
      daycareName,
      avatarColorClass,
    };
  } catch {
    return null;
  }
};
