'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { validateUserDomain, getAllowedDomain } from '@/lib/auth';
import { describeApiError, getAdminAccessMe } from '@/lib/api';
import type { AdminAccessMe } from '@/types/admin-access';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  /**
   * The signed-in admin's rank. Null while unknown — the backend still checks
   * it on every call, so the UI only uses it to decide what to offer.
   */
  access: AdminAccessMe | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  access: null,
  loading: true,
  signOut: async () => {},
});

/**
 * Whether this admin may use the portal: a company account is not enough, it
 * also needs a rank on the admin team. `denied` only on the backend's 403 —
 * an outage lets the admin in, since every call is checked server-side anyway.
 */
async function checkAdminAccess(): Promise<
  { denied: false; me: AdminAccessMe | null } | { denied: true; message: string }
> {
  try {
    return { denied: false, me: (await getAdminAccessMe()).data.data };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return { denied: true, message: describeApiError(error) };
    }
    console.error('[AuthProvider] Could not check admin access:', error);
    return { denied: false, me: null };
  }
}

export const useAuth = () => useContext(AuthContext);

/**
 * Pages opened from outside the portal (Claude's connector consent page)
 * come back after sign-in, with their query. Only `/connect/` paths, so the
 * login can't be turned into a redirect anywhere else.
 */
const RETURN_KEY = 'auth:returnTo';

function rememberReturn(path: string, search: string) {
  if (!path.startsWith('/connect/')) return;
  try {
    sessionStorage.setItem(RETURN_KEY, path + search);
  } catch {
    // Private mode: the agent lands on the portal and starts again from Claude.
  }
}

function takeReturn(): string | null {
  try {
    const target = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return target && target.startsWith('/connect/') && !target.startsWith('//')
      ? target
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AdminAccessMe | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const routerRef = useRef(router);

  // Keep router ref up to date
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    console.log('[AuthProvider] Initializing auth listener');

    if (!auth) {
      console.error('[AuthProvider] Firebase auth not initialized');
      // Defer setState to avoid calling it synchronously in effect
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthProvider] Auth state changed:', firebaseUser ? 'User signed in' : 'No user');
      
      if (firebaseUser) {
        console.log('[AuthProvider] User details:', {
          email: firebaseUser.email,
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
        });
        
        // Validate user domain
        const isValid = validateUserDomain(firebaseUser);
        console.log('[AuthProvider] Domain validation result:', isValid);
        
        if (isValid) {
          // Only the ranked admin team gets in. Checked before the user is
          // set, so an account without a rank never sees the dashboard.
          const checked = await checkAdminAccess();
          if (checked.denied) {
            console.warn(
              `[AuthProvider] ${firebaseUser.email} has no admin rank; signing out`
            );
            await signOut(auth);
            setUser(null);
            setAccess(null);
            toast.error(checked.message, { id: 'no-admin-rank', duration: 10000 });
            routerRef.current.push('/login');
            setLoading(false);
            return;
          }

          console.log('[AuthProvider] User domain is valid, setting user');
          setAccess(checked.me);
          setUser(firebaseUser);
          
          // Redirect away from login if already authenticated
          const currentPath = window.location.pathname;
          console.log('[AuthProvider] Current path:', currentPath);
          
          if (currentPath === '/login') {
            const back = takeReturn();
            // Not the URL itself: a /connect/ query carries OAuth state.
            console.log(
              back
                ? '[AuthProvider] Returning to the page that needed sign-in'
                : '[AuthProvider] Redirecting to /users',
            );
            routerRef.current.push(back ?? '/users');
          }
        } else {
          // User is not from allowed domain, sign them out
          console.warn(
            `[AuthProvider] User ${firebaseUser.email} is not from allowed domain @${getAllowedDomain()}`
          );
          console.log('[AuthProvider] Signing out unauthorized user');
          await signOut(auth);
          setUser(null);
          toast.error(
            `Access denied. Only @${getAllowedDomain()} accounts are allowed.`
          );
          routerRef.current.push('/login');
        }
      } else {
        console.log('[AuthProvider] No user signed in');
        setUser(null);
        setAccess(null);
        // Redirect to login if trying to access protected routes
        const currentPath = window.location.pathname;
        console.log('[AuthProvider] Current path:', currentPath);
        
        if (currentPath !== '/login' && !currentPath.startsWith('/_next')) {
          rememberReturn(currentPath, window.location.search);
          console.log('[AuthProvider] Redirecting to /login');
          routerRef.current.push('/login');
        }
      }
      setLoading(false);
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    console.log('[AuthProvider] Sign out initiated');
    if (!auth) {
      console.error('[AuthProvider] Cannot sign out - auth not initialized');
      return;
    }
    try {
      await signOut(auth);
      console.log('[AuthProvider] Sign out successful');
      routerRef.current.push('/login');
    } catch (error) {
      console.error('[AuthProvider] Error signing out:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, access, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
