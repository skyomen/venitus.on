// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EventoNaTela } from '@/nucleo/atendimento/linha-do-tempo';
import { LinhaDoTempo } from './linha-do-tempo';

const QUANDO = new Date(2026, 7, 26, 9, 41);

function evento(ajuste: Partial<EventoNaTela> = {}): EventoNaTela {
  return {
    id: 'e1',
    texto: 'De Na fila para Em atendimento',
    detalhe: null,
    quem: 'Fila',
    ocorridoEm: QUANDO,
    tom: 'neutro',
    ...ajuste,
  };
}

const formatar = (quando: Date) => `dia ${quando.getDate()}`;

describe('LinhaDoTempo', () => {
  it('diz o que aconteceu, quem fez e quando', () => {
    render(<LinhaDoTempo eventos={[evento()]} formatarData={formatar} />);

    expect(screen.getByText('De Na fila para Em atendimento')).toBeDefined();
    expect(screen.getByText(/Fila/)).toBeDefined();
    expect(screen.getByText(/dia 26/)).toBeDefined();
  });

  it('o detalhe entra quando existe', () => {
    render(
      <LinhaDoTempo eventos={[evento({ detalhe: 'não quis o seguro' })]} formatarData={formatar} />,
    );

    expect(screen.getByText('não quis o seguro')).toBeDefined();
  });

  it('sem data, a linha não mostra separador solto', () => {
    render(<LinhaDoTempo eventos={[evento({ ocorridoEm: null })]} formatarData={formatar} />);

    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('o tom do evento vira o marcador', () => {
    const { container } = render(
      <LinhaDoTempo eventos={[evento({ tom: 'bom' })]} formatarData={formatar} />,
    );

    expect(container.querySelector('.estado[data-tom="bom"]')).not.toBeNull();
  });

  it('é uma lista ordenada: a sequência é o dado', () => {
    render(
      <LinhaDoTempo
        eventos={[evento(), evento({ id: 'e2', texto: 'O cliente respondeu' })]}
        formatarData={formatar}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('sem evento, diz que ainda não há histórico', () => {
    render(<LinhaDoTempo eventos={[]} formatarData={formatar} />);

    expect(screen.getByText('Nada registrado ainda.')).toBeDefined();
  });
});
