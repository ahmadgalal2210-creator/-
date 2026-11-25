import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { primeOfflineDownloadCache } from './lib/offlineHtmlExporter';

registerSW({ immediate: true });

if (typeof window !== 'undefined') {
  window.setTimeout(() => {
    void primeOfflineDownloadCache();
  }, 1500);
}

createRoot(document.getElementById('root')!).render(<App />);
