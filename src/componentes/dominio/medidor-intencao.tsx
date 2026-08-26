import type { Intencao } from '@/nucleo/fila/prioridade';

/** Fria, morna, quente — a ordem é o próprio dado. */
const NIVEL: Readonly<Record<Intencao, number>> = { FRIA: 1, MORNA: 2, QUENTE: 3 };

const PALAVRA: Readonly<Record<Intencao, string>> = {
  FRIA: 'Fria',
  MORNA: 'Morna',
  QUENTE: 'Quente',
};

const TRACOS = [1, 2, 3] as const;

interface Props {
  readonly intencao: Intencao;
}

/**
 * A temperatura do cliente, em três traços.
 *
 * Design system §10: **não é uma pílula**. É um medidor que enche conforme a
 * intenção, com a palavra ao lado — nível, forma e cor codificando o mesmo dado
 * três vezes, para que ele seja legível de relance e sem depender de matiz.
 *
 * Os traços são decorativos: quem usa leitor de tela ouve a palavra.
 */
export function MedidorDeIntencao({ intencao }: Props) {
  const nivel = NIVEL[intencao];

  return (
    <span className="medidor" data-nivel={nivel}>
      <span className="medidor-tracos" aria-hidden="true">
        {TRACOS.map((traco) => (
          <span
            key={traco}
            className="medidor-traco"
            data-aceso={traco <= nivel ? '' : undefined}
          />
        ))}
      </span>
      <span className="medidor-palavra">{PALAVRA[intencao]}</span>
    </span>
  );
}
