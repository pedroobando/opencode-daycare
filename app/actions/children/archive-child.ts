'use server';

// WARNING: RLS in DB-03 only allows SELECT on `public.children` — there are no
// INSERT/UPDATE/DELETE policies yet. This action will fail at runtime with an
// RLS error until the write-policy spec lands (see SPEC 08 §Riesgos).

import { updateChild } from './update-child';
import type { UpdateChildState } from './types';

export const archiveChild = async (id: string): Promise<UpdateChildState> => {
  return updateChild(id, { status: 'archived' });
};
