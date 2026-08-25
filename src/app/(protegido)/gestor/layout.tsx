import type { ReactNode } from 'react';
import { MolduraArea } from '@/componentes/moldura-area';
import { exigirAcesso } from '@/seguranca/sessao';
import { modoDeDados } from '@/seguranca/modo-dados';
import { sair } from '@/app/(publico)/entrar/acoes';

const MENU = [
  { rotulo: 'Visão geral', destino: '/gestor/inicio' },
  { rotulo: 'Funil', destino: '/gestor/funil' },
  { rotulo: 'Equipe', destino: '/gestor/equipe' },
  { rotulo: 'Configuração', destino: '/gestor/configuracao' },
];

export default async function Layout({ children }: { children: ReactNode }) {
  const sessao = await exigirAcesso('/gestor');

  return (
    <MolduraArea
      modo={modoDeDados()}
      acaoSair={sair}
      titulo="Venitus.on · Gestão"
      nome={sessao.email}
      menu={MENU}
    >
      {children}
    </MolduraArea>
  );
}
