const DEVELOPMENT_CACHE_EPOCH = '2026-07-24-runtime-cost-v1';

// The LAN development build must never be held behind an old PWA shell.
// This deliberately avoids IndexedDB: Firestore/Auth persistence is not
// application cache data and must not be deleted during normal refreshes.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const previousEpoch = localStorage.getItem('makka-development-cache-epoch');
  if (previousEpoch !== DEVELOPMENT_CACHE_EPOCH) {
    localStorage.setItem('makka-development-cache-epoch', DEVELOPMENT_CACHE_EPOCH);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(item => item.unregister())))
        .catch(error => console.warn('Development SW cleanup failed:', error));
    }
    if ('caches' in window) {
      caches.keys()
        .then(names => Promise.all(names.map(name => caches.delete(name))))
        .catch(error => console.warn('Development cache cleanup failed:', error));
    }
  }
}

// Global handler for Vite chunk loading failures
window.addEventListener('vite:preloadError', () => {
  const isReloaded = sessionStorage.getItem('vite-reloaded');
  if (!isReloaded) {
    sessionStorage.setItem('vite-reloaded', 'true');
    window.location.reload();
  }
});

window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('Failed to fetch dynamically imported module')) {
    const isReloaded = sessionStorage.getItem('vite-reloaded');
    if (!isReloaded) {
      sessionStorage.setItem('vite-reloaded', 'true');
      window.location.reload();
    }
  }
});

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(<App />);
