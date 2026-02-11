import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './utils/sentry';

console.log('[index] Iniciando aplicación...');

// Inicializar Sentry antes de montar la app
try {
  initSentry();
  console.log('[index] Sentry inicializado');
} catch (e) {
  console.error('[index] Error inicializando Sentry:', e);
}

const rootElement = document.getElementById('root');
console.log('[index] Root element:', rootElement);

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('[index] React root creado, renderizando App...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('[index] Render llamado exitosamente');
} catch (e) {
  console.error('[index] Error al renderizar:', e);
  rootElement.innerHTML = '<div style="padding:20px;color:red;"><h1>Error al iniciar</h1><pre>' + (e.stack || e.message) + '</pre></div>';
}
