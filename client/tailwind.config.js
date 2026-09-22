/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'husk-brown': '#432C22',
        'roasted-coconut': '#6B4736',
        'shell-ivory': '#F8F2E8',
        'warm-cream': '#FFFDF8',
        'coir-tan': '#C79A6B',
        'palm-green': '#365A3D',
        'sage': '#82917A',
        'antique-brass': '#B89555',
        'charcoal': '#292522',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'boutique': '0 10px 30px -10px rgba(67, 44, 34, 0.08), 0 4px 6px -2px rgba(67, 44, 34, 0.04)',
        'boutique-card': '0 20px 40px -15px rgba(67, 44, 34, 0.12)',
        'brass-glow': '0 0 20px -5px rgba(184, 149, 85, 0.3)',
      },
      borderRadius: {
        'organic': '2rem 1rem 2.5rem 1rem',
        'coconut': '2.5rem 2.5rem 3rem 3rem',
      }
    },
  },
  plugins: [],
}
