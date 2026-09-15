import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { modules } from '@packages/capabilities/modules';

export const dynamic = 'force-dynamic';

/** Module meetings désactivé : la page n'existe pas, comme ses routes d'API. */
export default async function AdminMeetingsLayout({ children }: { children: ReactNode }) {
  if (!(await modules.enabled('meetings'))) notFound();
  return children;
}
