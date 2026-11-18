'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import {
  validateUserDomain,
  getAllowedDomain,
  isAllowedSignInProvider,
  isTransientAuthError,
  latestRun,
} from '@/lib/auth';
import { toast } from 'sonner';

/**
 * How this session signed in, read from the ID token's `sign_in_provider`
 * claim:
 * - `google`: allowed.
 * - `rejected`: another provider, or a token that can't be read for any
 *   reason but the network. The session is signed out (fails closed).
 * - `unverified`: the token needed a refresh and the network failed. The
 *   session itself is fine, so it is kept, but the portal stays closed until
 *   a reload or a new sign-in checks it again.
 */
async function sessionProvider(
  user: User,
): Promise<'google' | 'rejected' | 'unverified'> {
  try {
    const { signInProvider } = await user.getIdTokenResult();
    return isAllowedSignInProvider(signInProvider) ? 'google' : 'rejected';
  } catch (error) {
    console.error('[AuthProvider] Could not read the sign-in provider:', error);
    return isTransientAuthError(error) ? 'unverified' : 'rejected';
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

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
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const routerRef = useRef(router);
  // Every query is the signed-in admin's view (edit rights, their emails, …),
  // so none may outlive the session: the next admin to sign in on this tab
  // would see the last one's answers until each refetched.
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);

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

    const runs = latestRun();
    // Set when the listener goes away. Checked after awaiting signOut, which
    // itself fires the listener again (a new run), so run identity alone
    // can't tell whether this provider is still mounted.
    let disposed = false;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isCurrent = runs.begin();
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

        // Google sign-in only. A session from any other provider (e.g. a
        // password set through a reset email) is signed out here, the same
        // rule the backend enforces on every request.
        const provider = isValid ? await sessionProvider(firebaseUser) : null;

        // The session changed while its token was read (signed out in another
        // tab, another account signed in): the newer call owns the state, and
        // this one must not put the old user back.
        if (!isCurrent()) return;

        if (provider === 'unverified') {
          // Keep the session, keep the portal closed. Reloading, or signing
          // in again from /login, runs this check again.
          console.warn('[AuthProvider] Could not verify the sign-in provider; portal stays closed');
          setUser(null);
          toast.error(
            "We couldn't verify your sign-in. Check your connection, then reload or sign in again.",
          );
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            rememberReturn(currentPath, window.location.search);
            routerRef.current.push('/login');
          }
        } else if (provider === 'rejected') {
          console.warn('[AuthProvider] Session is not a Google sign-in, signing out');
          await signOut(auth);
          if (disposed) return;
          setUser(null);
          toast.error('Please sign in with your Google account.');
          routerRef.current.push('/login');
        } else if (isValid) {
          console.log('[AuthProvider] User domain is valid, setting user');
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
                : '[AuthProvider] Redirecting to /overview',
            );
            routerRef.current.push(back ?? '/overview');
          }
        } else {
          // User is not from allowed domain, sign them out
          console.warn(
            `[AuthProvider] User ${firebaseUser.email} is not from allowed domain @${getAllowedDomain()}`
          );
          console.log('[AuthProvider] Signing out unauthorized user');
          await signOut(auth);
          if (disposed) return;
          setUser(null);
          toast.error(
            `Access denied. Only @${getAllowedDomain()} accounts are allowed.`
          );
          routerRef.current.push('/login');
        }
      } else {
        console.log('[AuthProvider] No user signed in');
        setUser(null);
        // Signed out here, in another tab, or refused for the domain above
        // (whose signOut lands here too): drop the previous admin's data.
        queryClientRef.current.clear();
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
      disposed = true;
      runs.cancel();
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
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
