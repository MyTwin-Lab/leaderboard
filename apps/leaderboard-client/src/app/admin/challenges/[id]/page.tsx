'use client';

import { ChallengeManageView } from '@/components/challenges/ChallengeManageView';

// Admin-facing control room. Shares its entire implementation with the manager
// view; `isAdmin` skips the managership guard and keeps meetings always visible.
// Kept as a distinct route from the manager view on purpose (separate URL for logs).
export default function AdminChallengeDetailPage() {
  return <ChallengeManageView isAdmin />;
}
