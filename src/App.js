// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Diamond from './pages/Diamond';
import Jackies from './pages/Jackies';
import FloatingTabs from './components/FloatingTabs';
import './styles/FloatingTabs.module.css'; // Ensure global fadeIn/out CSS

function ScrollFadeWrapper({ children }) {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.remove('fadeOut');
    document.body.classList.add('fadeIn');
    return () => {
      document.body.classList.remove('fadeIn');
    };
  }, [location.pathname]);

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <FloatingTabs />
      <ScrollFadeWrapper>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/diamond" element={<Diamond />} />
          <Route path="/jackies" element={<Jackies />} />
        </Routes>
      </ScrollFadeWrapper>
    </BrowserRouter>
  );
}
