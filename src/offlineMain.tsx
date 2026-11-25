import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as unknown as { __OFFLINE_HTML_MODE__?: boolean }).__OFFLINE_HTML_MODE__ = true;

createRoot(document.getElementById('root')!).render(<App />);
