// Aggressively clean up stale Service Workers to prevent "Black Screen" or loading issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().then(() => {
        console.log('Unregistered SW');
      });
    }
  }).catch(err => console.warn('SW unregister error:', err));
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
