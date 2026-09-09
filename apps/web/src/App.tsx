import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Playground } from './pages/Playground';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Playground />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
