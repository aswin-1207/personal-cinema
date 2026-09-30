import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/cinemaTheme.css';

// Register PWA service worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('MyCinema Service Worker registered:', reg.scope);
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
