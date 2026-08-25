import type { ReactNode } from 'react';
import { Area } from '../area';

const MENU = [
  { rotulo: 'Visão geral', destino: '/gestor/inicio' },
  { rotulo: 'Funil', destino: '/gestor/funil' },
  { rotulo: 'Equipe', destino: '/gestor/equipe' },
  { rotulo: 'Configuração', destino: '/gestor/configuracao' },
];

// O gestor acompanha muita coisa de uma vez: densidade compacta (§06).
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Area area="/gestor" titulo="Venitus.on · Gestão" menu={MENU} densidade="compacta">
      {children}
    </Area>
  );
}
