import type { ReactNode } from 'react';
import { Estado } from '@/componentes/base/estado';
import type { CartaoDeOportunidade } from '@/nucleo/fila/cartao';
import { MedidorDeIntencao } from './medidor-intencao';

interface Props {
  readonly cartao: CartaoDeOportunidade;
  /** A ação primária. Vem de fora porque ela muda conforme a tela. */
  readonly acao: ReactNode;
}

/**
 * O cartão de oportunidade (design system §10, blueprint §9.5).
 *
 * O consultor nunca recebe "novo lead": recebe contexto suficiente para abrir a
 * conversa sabendo o que dizer. Cada linha aqui existe porque a operação real a
 * lê antes de ligar.
 *
 * Recebe DTO montado no servidor, **nunca a linha do banco** (§4.3). Quem decide
 * o que entra, em que ordem e com que tom é `nucleo/fila/cartao.ts`.
 */
export function CartaoOportunidade({ cartao, acao }: Props) {
  return (
    <article className="cartao-oportunidade" aria-labelledby={`cliente-${cartao.id}`}>
      <header className="cartao-oportunidade-topo">
        <div>
          <h3 id={`cliente-${cartao.id}`} className="cartao-oportunidade-nome">
            {cartao.nome}
          </h3>
          {cartao.veiculo !== null && <p className="apoio">{cartao.veiculo}</p>}
        </div>
        <MedidorDeIntencao intencao={cartao.intencao} />
      </header>

      <dl className="cartao-oportunidade-fatos">
        {cartao.fatos.map((fato) => (
          <div key={fato.rotulo}>
            <dt className="rotulo">{fato.rotulo}</dt>
            <dd>{fato.valor}</dd>
          </div>
        ))}

        {cartao.pendencia !== null && (
          <div>
            <dt className="rotulo">Pendência</dt>
            <dd>
              <Estado tom={cartao.pendencia.tom}>{cartao.pendencia.texto}</Estado>
            </dd>
          </div>
        )}

        <div>
          <dt className="rotulo">Tempo na fila</dt>
          <dd>
            <Estado tom={cartao.espera.tom}>{cartao.espera.texto}</Estado>
          </dd>
        </div>
      </dl>

      <div className="cartao-oportunidade-acao">{acao}</div>
    </article>
  );
}
