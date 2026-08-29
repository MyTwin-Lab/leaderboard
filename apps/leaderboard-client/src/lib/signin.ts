export type SignInVariantKey = 'default' | 'account-updated';

export interface SignInVariant {
  key: SignInVariantKey;
  /** Uppercase label sitting next to the brandCP rule, as on the home hero. */
  eyebrow: string;
  title: string;
  /** lines[0] leads and is set larger; the rest is supporting detail. */
  lines: string[];
}

/**
 * Copy shown above the "Continue with Google" button.
 *
 * `account-updated` covers a session whose user row is gone: an admin merged
 * the Google account into the placeholder that already held the person's
 * contributions (accountMerge.repo.ts deletes the absorbed row and moves
 * google_user_id onto the survivor), or removed the account outright.
 * check-session cannot tell those two apart — it only reports that the row is
 * missing — so the wording stays true either way and never promises a history
 * that a deleted account would not get back.
 */
const VARIANTS: Record<SignInVariantKey, SignInVariant> = {
  default: {
    key: 'default',
    eyebrow: 'Sign in',
    title: 'Sign in to track your work',
    lines: [
      'To follow your contributions, evaluate them and reward you in CP, we need to know who you are.',
      'We only read your name, your email address and your profile picture. Nothing is posted on your behalf, and nothing else in your Google account is accessed.',
    ],
  },
  'account-updated': {
    key: 'account-updated',
    eyebrow: 'Reconnect',
    title: 'Please sign in again',
    lines: [
      'Your account was updated by an administrator.',
      'Signing in again takes you to your up-to-date profile, with your full contribution history.',
    ],
  },
};

/**
 * Maps the `reason` query parameter onto a variant. The parameter is
 * attacker-controlled, so unknown values degrade to the explanation rather
 * than rendering a screen with no message.
 */
export function resolveSignInVariant(reason: string | null | undefined): SignInVariant {
  if (reason && Object.prototype.hasOwnProperty.call(VARIANTS, reason)) {
    return VARIANTS[reason as SignInVariantKey];
  }
  return VARIANTS.default;
}
