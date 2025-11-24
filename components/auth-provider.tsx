'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { validateUserDomain, getAllowedDomain } from '@/lib/auth';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
      setLoading(false);
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
          console.log('[AuthProvider] User domain is valid, setting user');
          setUser(firebaseUser);
          
          // Redirect away from login if already authenticated
          const currentPath = window.location.pathname;
          console.log('[AuthProvider] Current path:', currentPath);
          
          if (currentPath === '/login') {
            console.log('[AuthProvider] Redirecting to /users');
            routerRef.current.push('/users');
          }
        } else {
          // User is not from allowed domain, sign them out
          console.warn(
            `[AuthProvider] User ${firebaseUser.email} is not from allowed domain @${getAllowedDomain()}`
          );
          console.log('[AuthProvider] Signing out unauthorized user');
          await signOut(auth);
          setUser(null);
          alert(
            `Access denied. Only @${getAllowedDomain()} accounts are allowed.`
          );
          routerRef.current.push('/login');
        }
      } else {
        console.log('[AuthProvider] No user signed in');
        setUser(null);
        // Redirect to login if trying to access protected routes
        const currentPath = window.location.pathname;
        console.log('[AuthProvider] Current path:', currentPath);
        
        if (currentPath !== '/login' && !currentPath.startsWith('/_next')) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {!loading && children}
    </AuthContext.Provider>
  );
}
