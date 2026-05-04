import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Módulo 1 (Sentry) e Módulo 4 (Performance): Configuração Inicial do Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "", // O cliente deve fornecer o DSN ou cai no modo log local
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  // Session Replay
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
  environment: import.meta.env.MODE || "development"
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<div className="p-8 text-center"><h1 className="text-2xl font-bold text-red-500">Oops! Algo deu errado.</h1><p className="text-gray-600 mt-2">Nossa equipe foi notificada automaticamente.</p><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-white rounded">Tentar Novamente</button></div>}>
    <App />
  </Sentry.ErrorBoundary>
);
