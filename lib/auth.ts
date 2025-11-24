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

