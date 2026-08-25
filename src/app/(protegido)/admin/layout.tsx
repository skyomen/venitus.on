import type { ReactNode } from 'react';
import { Area } from '../area';

const MENU = [
  { rotulo: 'Visão geral', destino: '/admin/inicio' },
  { rotulo: 'Corretoras', destino: '/admin/corretoras' },
  { rotulo: 'Integrações', destino: '/admin/integracoes' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Area area="/admin" titulo="Venitus.on · Plataforma" menu={MENU} densidade="compacta">
      {children}
    </Area>
  );
}
