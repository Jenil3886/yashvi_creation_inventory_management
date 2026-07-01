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
  </StrictMode>
);
