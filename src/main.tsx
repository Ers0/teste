import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import './i18n'; // Import i18n configuration
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from './i18n'; // Import the i18n instance
import './lib/syncManager'; // Initialize the sync manager

createRoot(document.getElementById("root")!).render(
  <React.Suspense fallback="Loading...">
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.Suspense>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('Service Worker registered: ', registration);
    }).catch(registrationError => {
      console.log('Service Worker registration failed: ', registrationError);
    });
  });
}