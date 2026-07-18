import { initializeApp } from 'firebase/app';
import { 
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0332689520",
  appId: "1:1026583984887:web:21328419412a23964f71f2",
  apiKey: "AIzaSyAbFeNT1VcmFZ1hdz1SPMMEaAeb3ykJ5VA",
  authDomain: "gen-lang-client-0332689520.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-031a525c-7a85-4304-b0ca-6d60bd34adbf",
  storageBucket: "gen-lang-client-0332689520.firebasestorage.app",
  messagingSenderId: "1026583984887",
  measurementId: ""
};

import { OperationType } from './types';
export { OperationType };

const app = initializeApp(firebaseConfig);

// Stable Auth for PWA - Priority order: IndexedDB -> LocalStorage -> Session
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence, 
    browserLocalPersistence,
    browserSessionPersistence
  ]
});

// Persistent Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({}) 
  })
}, firebaseConfig.firestoreDatabaseId);

export const signIn = (email: string, password: string) => 
  signInWithEmailAndPassword(auth, email, password);

export const logOut = () => signOut(auth);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] at ${path}:`, error);
  throw error;
}
