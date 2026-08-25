import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { sair } from '@/app/(publico)/entrar/acoes';
import { SeletorTema } from '@/componentes/base/seletor-tema';
import { MolduraArea } from '@/componentes/moldura-area';
import type { Densidade, ItemMenu } from '@/componentes/moldura-area';
import { alternarTema } from '@/design/acoes';
import { COOKIE_TEMA, interpretarTema } from '@/design/tema';
import { modoDeDados } from '@/seguranca/modo-dados';
import { exigirAcesso } from '@/seguranca/sessao';

interface Props {
  readonly area: string;
  readonly titulo: string;
  readonly menu: readonly ItemMenu[];
  readonly densidade?: Densidade;
  readonly children: ReactNode;
}

/**
 * O que as três áreas têm em comum, num lugar só: autorização, modo de dados,
 * tema e saída.
 *
 * A autorização real acontece aqui, no servidor — o guard de rota é conveniência
 * (blueprint §4.1, V13).
 */
export async function Area({ area, titulo, menu, densidade, children }: Props) {
  const sessao = await exigirAcesso(area);
  const tema = interpretarTema((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <MolduraArea
      titulo={titulo}
      nome={sessao.email}
      modo={modoDeDados()}
      menu={menu}
      {...(densidade === undefined ? {} : { densidade })}
      seletorTema={<SeletorTema tema={tema} aoAlternar={alternarTema} />}
      acaoSair={sair}
    >
      {children}
    </MolduraArea>
  );
}
