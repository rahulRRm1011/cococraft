import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { HeroPlaceholder } from './components/HeroPlaceholder';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-warm-cream font-sans text-charcoal">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HeroPlaceholder />} />
            {/* Additional routes for catalogue, gift-box, cart will be mounted in upcoming checkpoints */}
            <Route path="*" element={<HeroPlaceholder />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
