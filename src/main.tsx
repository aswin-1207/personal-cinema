import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/cinemaTheme.css';

// Register PWA service worker with auto-update
const isProd = Boolean((import.meta as any).env?.PROD);
if ('serviceWorker' in navigator && isProd) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for updates immediately
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('MyCinema Service Worker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
