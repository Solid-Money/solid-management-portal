import { User } from 'firebase/auth';

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN || 'fuse.io';

/**
 * Checks if an email belongs to the allowed domain
 */
export function isAllowedDomain(email: string | null | undefined): boolean {
  console.log('[Auth Utils] Checking domain for email:', email);
  
  if (!email) {
    console.log('[Auth Utils] No email provided, returning false');
    return false;
  }
  
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const allowedDomain = ALLOWED_DOMAIN.toLowerCase();
  const isValid = emailDomain === allowedDomain;
  
  console.log('[Auth Utils] Email domain:', emailDomain, '| Allowed domain:', allowedDomain, '| Valid:', isValid);
  
  return isValid;
}

/**
 * Validates if a Firebase user belongs to the allowed domain
 */
export function validateUserDomain(user: User | null): boolean {
  console.log('[Auth Utils] Validating user domain:', user?.email);
  
  if (!user || !user.email) {
    console.log('[Auth Utils] No user or email, returning false');
    return false;
  }
  
  return isAllowedDomain(user.email);
}

/**
 * Gets the allowed domain for display purposes
 */
export function getAllowedDomain(): string {
  return ALLOWED_DOMAIN;
}

/**
 * The only way into the portal: Google sign-in, which carries the Workspace's
 * 2-Step Verification. The backend refuses every other provider (a password
 * set through a reset email, an email link, …), so the portal does too rather
 * than keep a session every request would bounce.
 */
export const ADMIN_SIGN_IN_PROVIDER = 'google.com';

/**
 * Whether a session's sign-in method is allowed. `signInProvider` is the
 * `firebase.sign_in_provider` claim of the user's ID token
 * (`user.getIdTokenResult()`), i.e. how this session signed in — not merely a
 * provider linked to the account.
 */
export function isAllowedSignInProvider(
  signInProvider: string | null | undefined,
): boolean {
  return signInProvider === ADMIN_SIGN_IN_PROVIDER;
}

/**
 * Lets only the newest of overlapping async runs act. Firebase calls the auth
 * listener again while an earlier call may still be awaiting (reading the ID
 * token), e.g. a sign-out in another tab: the earlier call must not then
 * apply its stale user. `begin()` starts a run and returns a check that stays
 * true until the next `begin()` or `cancel()`.
 */
export function latestRun() {
  let current = 0;
  return {
    begin(): () => boolean {
      const run = ++current;
      return () => run === current;
    },
    /** No run started so far may act any more (the listener is gone). */
    cancel(): void {
      current += 1;
    },
  };
}
