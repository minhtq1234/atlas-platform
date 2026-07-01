import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './brand/fonts.css';
import './index.css';
import { Router } from './app/Router';
import { setEngine, mockEngine } from './generation/engine';
import { makeHttpEngine, makeResilientEngine } from './generation/httpEngine';
import { useAppStore } from './store/useAppStore';

// Use the BFF (model-backed) when available, falling back to the in-browser
// mock if it's unreachable. VITE_BFF_URL overrides the default proxy path.
const bffUrl = import.meta.env.VITE_BFF_URL ?? '/bff';
let fallbackNotified = false;
setEngine(
  makeResilientEngine(makeHttpEngine(bffUrl), mockEngine, () => {
    if (fallbackNotified) return; // announce offline mode once per session
    fallbackNotified = true;
    useAppStore.getState().showToast('Atlas is offline — using the local preview engine.');
  }),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
