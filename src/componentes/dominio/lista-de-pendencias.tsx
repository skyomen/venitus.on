import type { ReactNode } from 'react';
import { Estado } from '@/componentes/base/estado';
import type { PendenciaNaTela } from '@/nucleo/atendimento/painel';

interface Props {
  readonly pendencias: readonly PendenciaNaTela[];
  /** A ação de cada item vem de fora: a lista não sabe resolver nada. */
  readonly acaoDe: (pendencia: PendenciaNaTela) => ReactNode;
}

/**
 * As pendências do atendimento (linguagem ubíqua: item rastreável com
 * responsável, prazo e alerta).
 *
 * A ordem é a da urgência, decidida em `nucleo/atendimento/painel.ts`. As
 * resolvidas continuam na lista, apagadas: sumir com elas faria o consultor
 * perguntar de novo por um documento que o cliente já mandou.
 */
export function ListaDePendencias({ pendencias, acaoDe }: Props) {
  if (pendencias.length === 0) {
    return (
      <div className="vazio">
        <strong>Nenhuma pendência.</strong>
        <p className="apoio">Nada trava esta oportunidade no momento.</p>
      </div>
    );
  }

  return (
    <ul className="lista-pendencias">
      {pendencias.map((pendencia) => (
        <li key={pendencia.id} data-resolvida={pendencia.resolvida ? '' : undefined}>
          <div>
            <Estado tom={pendencia.tom}>{pendencia.descricao}</Estado>
            <p className="apoio">{pendencia.prazo}</p>
          </div>
          {acaoDe(pendencia)}
        </li>
      ))}
    </ul>
  );
}
