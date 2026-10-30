import type { Config } from 'tailwindcss';

/**
 * Los colores de la interfaz se definen como variables CSS (ver globals.css) para que el
 * modo oscuro solo cambie los valores y no haga falta reescribir cada clase.
 */
const themed = (shades: number[], family: string) =>
  Object.fromEntries(shades.map((shade) => [shade, `rgb(var(--${family}-${shade}) / <alpha-value>)`]));

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-progress': {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.25s ease-out',
        'toast-progress': 'toast-progress linear forwards',
        'pop-in': 'pop-in 0.2s ease-out',
      },
      colors: {
        brand: themed([50, 100, 500, 600, 700], 'brand'),
        slate: themed([50, 100, 200, 300, 400, 500, 600, 700, 800, 900], 'slate'),
        emerald: themed([50, 100, 500, 600, 700, 800], 'emerald'),
        rose: themed([50, 100, 500, 600, 700, 800], 'rose'),
        amber: themed([100, 800], 'amber'),
        sky: themed([100, 800], 'sky'),
      },
    },
  },
  plugins: [],
};

export default config;
