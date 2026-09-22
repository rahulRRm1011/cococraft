import React, { useEffect, useState } from 'react';
import { checkApiHealth } from '../services/api';
import type { HealthResponse } from '../services/api';
import { Sparkles, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkApiHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const isDev = import.meta.env.DEV;

  return (
    <header className="sticky top-0 z-50 bg-warm-cream/95 backdrop-blur-md border-b border-coir-tan/20 transition-all duration-300">
      {/* Top artisanal badge banner */}
      <div className="bg-husk-brown text-shell-ivory text-xs tracking-widest uppercase py-1.5 px-4 text-center font-sans flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-antique-brass" />
        <span>Kerala Artisan Heritage • 100% Zero-Waste Coconut Crafts</span>
        <span className="hidden md:inline-block text-antique-brass/80">• Ethical Direct Trade</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-husk-brown text-antique-brass flex items-center justify-center shadow-md border border-antique-brass/30">
              <span className="font-serif text-2xl font-bold italic">C</span>
            </div>
            <div>
              <a href="/" className="group inline-block">
                <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-husk-brown group-hover:text-roasted-coconut transition-colors">
                  Coco<span className="text-antique-brass font-normal italic">Craft</span>
                </span>
              </a>
              <p className="text-[10px] tracking-wider uppercase text-sage font-medium -mt-1 hidden sm:block">
                Kerala Atelier & Homeware
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-roasted-coconut">
            <a href="#collections" className="hover:text-husk-brown transition-colors">Collections</a>
            <a href="#artisans" className="hover:text-husk-brown transition-colors">Master Artisans</a>
            <a href="#sustainability" className="hover:text-husk-brown transition-colors">Zero-Waste Story</a>
            <a href="#gift-boxes" className="hover:text-husk-brown transition-colors flex items-center gap-1.5">
              <span>Gift Boxes</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-shell-ivory border border-coir-tan/30 text-antique-brass">Bespoke</span>
            </a>
          </nav>

          {/* Right Action / Dev Connection Badge */}
          <div className="flex items-center gap-3">
            {isDev && (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all duration-200"
                title="Express API connectivity status (Visible only during development)"
              >
                {loading ? (
                  <div className="flex items-center gap-1.5 text-coir-tan bg-shell-ivory px-2.5 py-1 rounded-full border border-coir-tan/30">
                    <RefreshCw className="w-3 h-3 animate-spin text-coir-tan" />
                    <span className="font-mono text-[11px]">Connecting API...</span>
                  </div>
                ) : health?.success ? (
                  <div className="flex items-center gap-1.5 text-palm-green bg-palm-green/10 border border-palm-green/30 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-palm-green animate-pulse" />
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-mono text-[11px] font-medium">Express API 4000: OK</span>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full cursor-help"
                    title={error || 'Express API is offline'}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="font-mono text-[11px]">API Offline</span>
                    <button
                      onClick={testConnection}
                      className="ml-1 hover:rotate-180 transition-transform duration-300"
                      aria-label="Retry connection"
                    >
                      <RefreshCw className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
