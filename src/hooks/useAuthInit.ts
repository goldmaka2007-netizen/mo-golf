import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signIn } from '../firebase';
import { useAppStore } from '../store';
import { isAdminEmail } from '../lib/adminAccess';

export const useAuthInit = () => {
  const { setUser, setIsAuthReady } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isStandalone = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone);

  // Profile Sync
  const syncUserToFirestore = useCallback(async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          role: isAdminEmail(user.email) ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("[Auth] Firestore Sync Skip:", e);
    }
  }, [setUser, setIsAuthReady]);

  // Update Global State
  const finish = useCallback(async (user: User | null) => {
    if (user) await syncUserToFirestore(user);
    setUser(user);
    setIsAuthReady(true);
    setLoading(false);
    setIsSigningIn(false);
  }, [setUser, setIsAuthReady, syncUserToFirestore]);

  useEffect(() => {
    const isMounted = true;
    
    // Main Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      console.log("[Auth] State changed handler:", user ? "authenticated" : "signed-out");
      await finish(user);
    });

    return () => {
      unsubscribe();
    };
  }, [finish]);

  const handleSignIn = async (email: string, password: string) => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);

    try {
      console.log("[Auth] Attempting email/password sign in...");
      await signIn(email, password);
    } catch (e: any) {
      console.error('[Auth] Sign In Error:', e.message);
      setIsSigningIn(false);
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        setAuthError('إيميل أو كلمة مرور غلط');
      } else {
        setAuthError(`خطأ: ${e.code}`);
      }
    } 
  };

  return { loading, authError, isSigningIn, isStandalone, handleSignIn };
};
