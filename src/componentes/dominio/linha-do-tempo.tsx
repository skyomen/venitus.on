import { Estado } from '@/componentes/base/estado';
import type { EventoNaTela } from '@/nucleo/atendimento/linha-do-tempo';

interface Props {
  readonly eventos: readonly EventoNaTela[];
  /** Como escrever a data. Vem de fora para a formatação não vazar no servidor. */
  readonly formatarData: (quando: Date) => string;
}

/**
 * A linha do tempo da oportunidade (blueprint §15.1).
 *
 * É o que impede o consultor de repetir o que a automação já fez. Cada evento
 * diz o que aconteceu, quem fez e quando — nessa ordem, porque é a ordem em que
 * a pergunta aparece na cabeça de quem está lendo.
 */
export function LinhaDoTempo({ eventos, formatarData }: Props) {
  if (eventos.length === 0) {
    return (
      <div className="vazio">
        <strong>Nada registrado ainda.</strong>
        <p className="apoio">
          Cada passo do atendimento aparece aqui, do mais recente ao mais antigo.
        </p>
      </div>
    );
  }

  return (
    <ol className="linha-do-tempo">
      {eventos.map((evento) => (
        <li key={evento.id}>
          <Estado tom={evento.tom}>{evento.texto}</Estado>
          {evento.detalhe !== null && <p className="apoio">{evento.detalhe}</p>}
          <p className="apoio">
            {evento.quem}
            {evento.ocorridoEm !== null && ` · ${formatarData(evento.ocorridoEm)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
