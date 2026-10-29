import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Tienda Test',
  description: 'Gestion de ventas, entregas, pagos e inventario',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
