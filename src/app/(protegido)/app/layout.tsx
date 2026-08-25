import type { ReactNode } from 'react';
import { Area } from '../area';

// Menu do consultor, fixo (design system §01).
const MENU = [
  { rotulo: 'Início', destino: '/app/inicio' },
  { rotulo: 'Clientes', destino: '/app/clientes' },
  { rotulo: 'Atendimentos', destino: '/app/atendimentos' },
  { rotulo: 'Cotações', destino: '/app/cotacoes' },
  { rotulo: 'Propostas', destino: '/app/propostas' },
  { rotulo: 'Apólices', destino: '/app/apolices' },
  { rotulo: 'Carteira', destino: '/app/carteira' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Area area="/app" titulo="Venitus.on" menu={MENU}>
      {children}
    </Area>
  );
}
