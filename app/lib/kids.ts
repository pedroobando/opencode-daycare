// Mock data removed in SPEC 09; view-model types only (Kid + Parent hierarchy
// + avatar helpers). Real data now lives in Supabase and is fetched via
// `app/actions/children/list-children` / `get-child-by-id`.

export type ParentStatus = 'active' | 'pending';

export interface Parent {
  id: string;
  name: string;
  role: string;
  status: ParentStatus;
  initial: string;
  color: string;
}

export interface Kid {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  birthDate: string;
  roomId: string;
  roomName: string;
  enrollmentDate: string;
  initial: string;
  color: string;
  allergies?: string;
  linkedParents: Parent[];
}

const avatarTextColors: Record<string, string> = {
  '#A9D9E8': '#1F7A93',
  '#A9C7E8': '#1F7A93',
  '#F4B8CC': '#C44A7A',
  '#B9DEC4': '#3E8B62',
  '#F4DC8E': '#9A7B1E',
  '#C9B6E8': '#7B5FC0',
};

export const getAvatarTextColor = (backgroundColor: string): string => {
  return avatarTextColors[backgroundColor.toUpperCase()] ?? '#3F362E';
};
