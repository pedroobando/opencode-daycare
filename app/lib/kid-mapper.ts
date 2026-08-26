import type { ChildWithRoom } from '@/app/actions/children';
import type { Kid } from '@/app/lib/kids';
import { pickNextColor } from '@/app/utils/avatar-colors';

export type KidWithUnsetColor = Omit<Kid, 'color'>;

export const computeAge = (birthDateIso: string): number => {
  const [year, month, day] = birthDateIso.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

export const splitFullName = (
  fullName: string,
): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
};

export const childToKidWithoutColor = (
  child: ChildWithRoom,
): KidWithUnsetColor => {
  const { firstName, lastName } = splitFullName(child.full_name);
  const roomName = child.rooms?.name ?? '';
  return {
    id: child.id,
    firstName,
    lastName,
    age: computeAge(child.birth_date),
    birthDate: child.birth_date,
    roomId: child.room_id,
    roomName,
    enrollmentDate: child.enrolled_at,
    initial: firstName.charAt(0).toUpperCase(),
    allergies:
      child.allergy_tags.length > 0 ? child.allergy_tags.join(', ') : undefined,
    linkedParents: [],
  };
};

export const assignColorsDeterministic = (
  kids: KidWithUnsetColor[],
): Kid[] => {
  const result: Kid[] = [];
  for (const k of kids) {
    result.push({ ...k, color: pickNextColor(result, (kid) => kid.color) });
  }
  return result;
};
