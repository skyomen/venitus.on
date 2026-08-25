import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { COOKIE_TEMA, atributoDoTema, interpretarTema } from '@/design/tema';
import './globals.css';

export const metadata: Metadata = {
  title: 'Venitus.on',
  description: 'Operação comercial de seguros pronta para usar',
};

// Mobile primeiro (design system §01): o consultor atende do celular.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a1622' },
    { media: '(prefers-color-scheme: light)', color: '#f2f6fa' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // O tema é resolvido no servidor: aplicá-lo no cliente faria a página abrir no
  // tema errado e piscar ao corrigir.
  const tema = interpretarTema((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <html lang="pt-BR" data-tema={atributoDoTema(tema)}>
      <body>{children}</body>
    </html>
  );
}
