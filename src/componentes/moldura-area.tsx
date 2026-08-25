import Link from 'next/link';
import type { ReactNode } from 'react';
import { FaixaModo } from '@/componentes/base/faixa-modo';
import type { ModoDados } from '@/seguranca/modo-dados';

export interface ItemMenu {
  readonly rotulo: string;
  readonly destino: string;
}

export type Densidade = 'confortavel' | 'compacta';

interface Props {
  readonly titulo: string;
  readonly nome: string;
  readonly modo: ModoDados;
  readonly menu: readonly ItemMenu[];
  readonly densidade?: Densidade;
  /** Slot: a moldura não conhece o seletor, só reserva o lugar dele. */
  readonly seletorTema?: ReactNode;
  readonly acaoSair: () => Promise<void>;
  readonly children: ReactNode;
}

/**
 * Moldura comum às três áreas.
 *
 * Recebe modo, seletor de tema e ação de sair por parâmetro em vez de
 * importá-los. Isso a
 * mantém ignorante sobre autenticação e ambiente — e testável sem servidor.
 *
 * Recebe apenas o que a tela mostra. Nenhuma linha de banco atravessa a
 * fronteira (blueprint §4.3).
 */
export function MolduraArea({
  titulo,
  nome,
  modo,
  menu,
  densidade = 'confortavel',
  seletorTema,
  acaoSair,
  children,
}: Props) {
  return (
    <div className="area" data-densidade={densidade}>
      <FaixaModo modo={modo} />

      <header className="cabecalho">
        <strong>{titulo}</strong>

        <nav aria-label="Menu principal">
          {menu.map((item) => (
            <Link key={item.destino} href={item.destino}>
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <div className="usuario">
          <span>{nome}</span>
          {seletorTema}
          <form action={acaoSair}>
            <button type="submit" className="ligacao">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="conteudo">{children}</main>
    </div>
  );
}
