import type { Metadata } from 'next';

import { FeedbackProvider } from '@/components/ui/FeedbackProvider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Tienda Test',
  description: 'Gestion de ventas, entregas, pagos e inventario',
};

// Se ejecuta antes de pintar para aplicar el tema guardado (o el del sistema) sin parpadeo.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
