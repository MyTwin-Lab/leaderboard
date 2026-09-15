'use client';

import { useParams } from 'next/navigation';
import { ChallengeManageView } from '@/components/challenges/ChallengeManageView';

// Admin-facing control room. Shares its entire implementation with the manager
// view; `isAdmin` skips the managership guard and keeps meetings always visible.
// Kept as a distinct route from the manager view on purpose (separate URL for logs).
// Admin URLs stay on the UUID: they are private and never indexed.
export default function AdminChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ChallengeManageView challengeId={id} isAdmin />;
}
