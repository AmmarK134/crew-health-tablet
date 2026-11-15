import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/views.css';
import App from './App';

// Which page this is decides how the interface scales with the screen (see tokens.css).
const query = new URLSearchParams(window.location.search);
document.documentElement.dataset.page = query.get('wall') ? 'wall' : query.get('device') === 'cuff' ? 'cuff' : 'tablet';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
