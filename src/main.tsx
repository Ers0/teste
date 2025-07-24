import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import i18n from './i18n';
import { I18nextProvider } from 'react-i18next';

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <React.Suspense fallback="Loading...">
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </React.Suspense>
  </React.StrictMode>
);