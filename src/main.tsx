// Define global process variable at runtime before other imports
if (typeof window !== 'undefined') {
  (window as any).process = {
    env: {
      VITE_API_URL: import.meta.env.VITE_API_URL || '',
      NODE_ENV: import.meta.env.MODE || 'development',
    },
  };
}

// Auto-unregister stale service workers in development to prevent Dev Server hijacking
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.warn(
            'Cleared stale production Service Worker to allow local dev server to boot.',
          );
          window.location.reload(); // Reload to fetch fresh files
        }
      });
    }
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import useThemeStore from './store/useThemeStore';

// Initialize the saved user theme (Light/Dark mode) immediately
useThemeStore.getState().initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
