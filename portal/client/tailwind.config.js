/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy:       { DEFAULT: '#0D1B3E', mid: '#1A2F5E', light: '#243A75' },
        gold:       { DEFAULT: '#C9A84C', light: '#E8C97A', soft: 'rgba(201,168,76,0.15)' },
        cream:      { DEFAULT: '#FAF8F2', dark: '#F0EDE4' },
        card:       '#F4F4F6',
        success:    '#22C55E',
        error:      '#EF4444',
        warning:    '#F97316',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:    '0 4px 24px rgba(13,27,62,0.08)',
        'card-hover': '0 8px 40px rgba(13,27,62,0.15)',
        gold:    '0 4px 24px rgba(201,168,76,0.25)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':   'fadeIn 0.4s ease-out',
        'slide-up':  'slideUp 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(201,168,76,0)' } },
      },
    },
  },
  plugins: [],
}
