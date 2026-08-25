import type { ReactNode } from 'react';
import { MolduraArea } from '@/componentes/moldura-area';
import { exigirAcesso } from '@/seguranca/sessao';
import { modoDeDados } from '@/seguranca/modo-dados';
import { sair } from '@/app/(publico)/entrar/acoes';

// Menu do consultor, fixo (blueprint §5.4).
const MENU = [
  { rotulo: 'Início', destino: '/app/inicio' },
  { rotulo: 'Clientes', destino: '/app/clientes' },
  { rotulo: 'Atendimentos', destino: '/app/atendimentos' },
  { rotulo: 'Cotações', destino: '/app/cotacoes' },
  { rotulo: 'Propostas', destino: '/app/propostas' },
  { rotulo: 'Apólices', destino: '/app/apolices' },
  { rotulo: 'Carteira', destino: '/app/carteira' },
];

export default async function Layout({ children }: { children: ReactNode }) {
  // A autorização real acontece aqui, não no middleware.
  const sessao = await exigirAcesso('/app');

  return (
    <MolduraArea
      modo={modoDeDados()}
      acaoSair={sair}
      titulo="Venitus.on"
      nome={sessao.email}
      menu={MENU}
    >
      {children}
    </MolduraArea>
  );
}
