import type { ReactNode } from 'react';
import { MolduraArea } from '@/componentes/moldura-area';
import { exigirAcesso } from '@/seguranca/sessao';
import { modoDeDados } from '@/seguranca/modo-dados';
import { sair } from '@/app/(publico)/entrar/acoes';

const MENU = [
  { rotulo: 'Visão geral', destino: '/admin/inicio' },
  { rotulo: 'Corretoras', destino: '/admin/corretoras' },
  { rotulo: 'Integrações', destino: '/admin/integracoes' },
];

export default async function Layout({ children }: { children: ReactNode }) {
  const sessao = await exigirAcesso('/admin');

  return (
    <MolduraArea
      modo={modoDeDados()}
      acaoSair={sair}
      titulo="Venitus.on · Plataforma"
      nome={sessao.email}
      menu={MENU}
    >
      {children}
    </MolduraArea>
  );
}
