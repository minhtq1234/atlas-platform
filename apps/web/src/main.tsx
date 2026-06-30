import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './brand/fonts.css';
import './index.css';
import { Router } from './app/Router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
