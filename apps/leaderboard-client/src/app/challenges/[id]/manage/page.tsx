'use client';

import { ChallengeManageView } from '@/components/challenges/ChallengeManageView';

// Manager-facing control room. Access is guarded inside the view against the
// caller's managed projects. Kept as a distinct route from the admin view on
// purpose (separate URL for logs/analytics).
export default function ChallengeManagePage() {
  return <ChallengeManageView />;
}
