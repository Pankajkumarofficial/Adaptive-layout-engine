import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Playground } from './pages/Playground';
import { SharedView } from './pages/SharedView';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Playground />} />
        <Route path="/s/:slug" element={<SharedView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
