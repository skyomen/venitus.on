import type { ReactNode } from 'react';
import type { OpcaoNaTela } from '@/nucleo/atendimento/painel';

interface Props {
  readonly opcoes: readonly OpcaoNaTela[];
  readonly acaoDe: (opcao: OpcaoNaTela) => ReactNode;
}

/**
 * As opções que as seguradoras retornaram.
 *
 * Ordenadas do mais barato ao mais caro, que é a ordem em que a conversa
 * acontece — o cliente pergunta o preço primeiro. A escolhida é marcada por
 * texto e por atributo, nunca só por cor de fundo.
 */
export function OpcoesDeCotacao({ opcoes, acaoDe }: Props) {
  if (opcoes.length === 0) {
    return (
      <div className="vazio">
        <strong>Nenhuma opção retornada.</strong>
        <p className="apoio">
          Assim que a seguradora responder à cotação, os planos aparecem aqui para comparar.
        </p>
      </div>
    );
  }

  return (
    <ul className="lista-opcoes">
      {opcoes.map((opcao) => (
        <li key={opcao.id} data-escolhida={opcao.escolhida ? '' : undefined}>
          <div className="lista-opcoes-plano">
            <strong>{opcao.nomePlano}</strong>
            <span className="apoio">{opcao.seguradora}</span>
            {opcao.escolhida && <span className="apoio">Plano de interesse do cliente</span>}
          </div>

          <dl className="lista-opcoes-numeros">
            <div>
              <dt className="rotulo">Prêmio</dt>
              <dd className="num">{opcao.premio}</dd>
            </div>
            <div>
              <dt className="rotulo">Franquia</dt>
              <dd className="num">{opcao.franquia}</dd>
            </div>
          </dl>

          {acaoDe(opcao)}
        </li>
      ))}
    </ul>
  );
}
