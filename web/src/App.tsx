import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { ROUTER_BASENAME } from './config';
import GamePage from './pages/GamePage';
import PortalPage from './pages/PortalPage';

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Header />
      <Routes>
        <Route path="/" element={<PortalPage />} />
        <Route path="/g/:slug" element={<GamePage />} />
        <Route path="*" element={<PortalPage />} />
      </Routes>
    </BrowserRouter>
  );
}
