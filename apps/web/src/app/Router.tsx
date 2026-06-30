import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Studio } from '../pages/Studio';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio/:id" element={<Studio />} />
      </Routes>
    </BrowserRouter>
  );
}
