import React from 'react';
import { Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-husk-brown text-shell-ivory border-t border-roasted-coconut">
      {/* Top artisanal note banner */}
      <div className="border-b border-roasted-coconut/60 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          
          <div className="space-y-2">
            <h4 className="font-serif text-xl text-warm-cream font-medium">Reclaiming Kerala's Heritage</h4>
            <p className="text-xs text-shell-ivory/70 leading-relaxed font-light">
              Every CocoCraft creation is handcrafted from coconut shells reclaimed from local agricultural harvests across Kerala, preventing open burning and preserving ancestral wood-carving techniques.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-serif text-xl text-warm-cream font-medium">100% Food-Safe & Natural</h4>
            <p className="text-xs text-shell-ivory/70 leading-relaxed font-light">
              Polished exclusively with natural cold-pressed virgin coconut oil and organic beeswax. Safe for hot or cold dining, naturally heat-resistant, and entirely free of synthetic polymers.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-serif text-xl text-warm-cream font-medium">Architectural Excellence</h4>
            <p className="text-xs text-shell-ivory/70 leading-relaxed font-light">
              Built with React, Express, Strapi CMS, and dual SQLite architectures. Portfolio-grade engineering adhering to strict API facade boundaries.
            </p>
          </div>

        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-roasted-coconut text-antique-brass flex items-center justify-center border border-antique-brass/40">
              <span className="font-serif text-lg font-bold italic">C</span>
            </div>
            <div>
              <span className="font-serif text-xl tracking-tight text-warm-cream">
                Coco<span className="text-antique-brass italic">Craft</span>
              </span>
              <p className="text-[10px] text-shell-ivory/60 tracking-wider uppercase">
                Sustainable Coconut-Shell Marketplace
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-shell-ivory/80">
            <a href="#about" className="hover:text-warm-cream transition-colors">Artisan Guild</a>
            <a href="#sustainability" className="hover:text-warm-cream transition-colors">Zero-Waste Manifesto</a>
            <a href="#care" className="hover:text-warm-cream transition-colors">Shell Care Guide</a>
            <a href="#terms" className="hover:text-warm-cream transition-colors">Ethical Trade Policy</a>
          </div>

          <div className="text-xs text-shell-ivory/60 flex items-center gap-1">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-antique-brass inline fill-antique-brass" />
            <span>for Kerala Artisans</span>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-roasted-coconut/50 text-center text-xs text-shell-ivory/40">
          <p>© {new Date().getFullYear()} CocoCraft Marketplace. All rights reserved. Checkpoint 1 Architectural Foundation.</p>
        </div>
      </div>
    </footer>
  );
};
