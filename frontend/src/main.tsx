import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

// Register PWA service worker with prompt for updates
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of WhisperLink is available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('WhisperLink is ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
