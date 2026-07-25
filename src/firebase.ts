import { initializeApp, type FirebaseOptions } from 'firebase/app';
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

const requiredEnv = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required Vite environment variable: ${name}`);
  }
  return value.trim();
};

const firebaseConfig: FirebaseOptions = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
};

export const firebaseProjectId = firebaseConfig.projectId as string;
export const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim() || '(default)';

import { OperationType } from './types';
export { OperationType };

const app = initializeApp(firebaseConfig);

console.info(`[Firebase] projectId: ${firebaseProjectId}`);
console.info(`[Firebase] Firestore databaseId: ${firestoreDatabaseId}`);

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
}, firestoreDatabaseId);

export const signIn = (email: string, password: string) => 
  signInWithEmailAndPassword(auth, email, password);

export const logOut = () => signOut(auth);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] at ${path}:`, error);
  throw error;
}
