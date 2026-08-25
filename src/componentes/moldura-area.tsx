import Link from 'next/link';
import { rotuloDoModo } from '@/seguranca/modo-dados';
import type { ModoDados } from '@/seguranca/modo-dados';

export interface ItemMenu {
  readonly rotulo: string;
  readonly destino: string;
}

interface Props {
  readonly titulo: string;
  readonly nome: string;
  readonly modo: ModoDados;
  readonly menu: readonly ItemMenu[];
  readonly acaoSair: () => Promise<void>;
  readonly children: React.ReactNode;
}

/**
 * Moldura comum às três áreas.
 *
 * Recebe o modo e a ação de sair por parâmetro em vez de importá-los. Isso a
 * mantém ignorante sobre autenticação e ambiente — e testável sem servidor.
 *
 * Recebe apenas o que a tela mostra. Nenhuma linha de banco atravessa a
 * fronteira (blueprint §4.3).
 */
export function MolduraArea({ titulo, nome, modo, menu, acaoSair, children }: Props) {
  return (
    <div className="area">
      {/* O modo de dados ativo aparece sempre, com cor própria (§18). */}
      <div className={`faixa-modo faixa-modo--${modo}`} role="status">
        {rotuloDoModo(modo)}
      </div>

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
