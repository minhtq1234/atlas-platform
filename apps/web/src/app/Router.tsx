import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Studio } from '../pages/Studio';
import { ErrorBoundary } from './ErrorBoundary';

export function Router() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio/:id" element={<Studio />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
