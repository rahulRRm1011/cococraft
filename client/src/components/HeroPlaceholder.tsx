import React from 'react';
import { Compass, Leaf, Award, ArrowRight } from 'lucide-react';

export const HeroPlaceholder: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32 bg-warm-cream">
      {/* Background Subtle Organic Accents & Coir Texture */}
      <div className="absolute inset-0 bg-coir-subtle opacity-40 pointer-events-none" />
      
      {/* Ambient glowing radial shapes echoing coconut shells */}
      <div 
        className="absolute top-1/4 -right-24 w-96 h-96 rounded-full bg-coir-tan/10 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-palm-green/10 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Narrative */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-shell-ivory border border-coir-tan/40 text-husk-brown text-xs tracking-wider uppercase font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-antique-brass" />
              <span>Authentic Kerala Craftsmanship</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-husk-brown font-normal leading-[1.12]">
              Elevated Living from the <br />
              <span className="italic font-medium text-roasted-coconut">Sacred Coconut Shell</span>
            </h1>

            <p className="text-base sm:text-lg text-charcoal/80 max-w-2xl mx-auto lg:mx-0 font-light leading-relaxed">
              Hand-carved, sanded with river stone, and polished with organic cold-pressed coconut oil. 
              We partner directly with master rural artisans across the backwaters of Alappuzha to transform discarded coconut shells into timeless boutique dining, homeware, and curated gifting pieces.
            </p>

            {/* Value pillars */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto lg:mx-0 text-left">
              <div className="p-3.5 rounded-xl bg-shell-ivory/80 border border-coir-tan/20 shadow-sm">
                <div className="flex items-center gap-2 text-palm-green mb-1 font-serif font-semibold text-base">
                  <Leaf className="w-4 h-4" />
                  <span>100% Biodegradable</span>
                </div>
                <p className="text-xs text-charcoal/70">Reclaimed shells, zero synthetic varnishes or plastics.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-shell-ivory/80 border border-coir-tan/20 shadow-sm">
                <div className="flex items-center gap-2 text-antique-brass mb-1 font-serif font-semibold text-base">
                  <Award className="w-4 h-4" />
                  <span>Direct Artisan Guild</span>
                </div>
                <p className="text-xs text-charcoal/70">Fair wage living for traditional Kerala craft clusters.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-shell-ivory/80 border border-coir-tan/20 shadow-sm">
                <div className="flex items-center gap-2 text-husk-brown mb-1 font-serif font-semibold text-base">
                  <Compass className="w-4 h-4" />
                  <span>Bespoke Gifting</span>
                </div>
                <p className="text-xs text-charcoal/70">Custom engraved keepsake boxes and gift hampers.</p>
              </div>
            </div>

            {/* Call to action & exploration teaser */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button 
                type="button"
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-husk-brown hover:bg-roasted-coconut text-shell-ivory font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-boutique group"
              >
                <span>Explore Artisan Catalogue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <span className="text-xs text-sage font-medium tracking-wide">
                (Catalogue & Bespoke Gift Builder launching in Checkpoint 2)
              </span>
            </div>

          </div>

          {/* Right Column: Artisan Aesthetics Visual Showcase */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Outer decorative coconut curve frame */}
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-coir-tan/30 via-antique-brass/20 to-transparent transform rotate-2 scale-105 pointer-events-none" />

              {/* Main Showcase Card */}
              <div className="relative rounded-[2.5rem] bg-shell-ivory border border-coir-tan/30 p-8 shadow-boutique-card overflow-hidden">
                {/* Brass Corner Emblem */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-cream border border-antique-brass/40 text-[11px] font-mono text-antique-brass">
                  <span>Kerala Atelier • Edition 01</span>
                </div>

                <div className="mt-6 space-y-6">
                  {/* Organic Coconut Motif Graphic */}
                  <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-husk-brown via-roasted-coconut to-charcoal p-6 flex flex-col justify-between text-shell-ivory relative overflow-hidden shadow-inner">
                    {/* Abstract Coconut Geometry */}
                    <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full border border-antique-brass/20 pointer-events-none" />
                    <div className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full border border-antique-brass/10 pointer-events-none" />

                    <div className="space-y-1 z-10">
                      <span className="text-xs uppercase tracking-widest text-antique-brass font-mono">Boutique Collection</span>
                      <h3 className="text-2xl font-serif font-normal italic text-warm-cream">The Keralam Harvest Bowl</h3>
                    </div>

                    <div className="z-10 flex items-end justify-between border-t border-shell-ivory/10 pt-4">
                      <div>
                        <p className="text-[11px] text-shell-ivory/70 uppercase tracking-wider">Origin</p>
                        <p className="text-xs font-serif font-medium text-warm-cream">Kumarakom, Kerala</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-shell-ivory/70 uppercase tracking-wider">Finish</p>
                        <p className="text-xs font-serif font-medium text-warm-cream">Cold-Pressed Virgin Oil</p>
                      </div>
                    </div>
                  </div>

                  {/* Artisan Craftsmanship Heritage Card */}
                  <div className="border-t border-coir-tan/20 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-charcoal/70">
                      <span className="font-serif font-medium text-roasted-coconut italic">The Master Carver's Touch</span>
                      <span className="text-[11px] font-sans text-palm-green font-medium">100% Hand-Polished</span>
                    </div>
                    <p className="text-xs text-charcoal/75 leading-relaxed font-light">
                      Each piece carries the natural grain, texture, and organic contours of the Kerala backwater palms, sealed only with natural cold-pressed coconut oil.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
