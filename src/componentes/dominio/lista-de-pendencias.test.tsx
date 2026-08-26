// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PendenciaNaTela } from '@/nucleo/atendimento/painel';
import { ListaDePendencias } from './lista-de-pendencias';

function pendencia(ajuste: Partial<PendenciaNaTela> = {}): PendenciaNaTela {
  return {
    id: 'p1',
    descricao: 'Enviar CNH',
    tom: 'atencao',
    prazo: 'Vence amanhã',
    resolvida: false,
    ...ajuste,
  };
}

describe('ListaDePendencias', () => {
  it('mostra a descrição e o prazo em palavras', () => {
    render(<ListaDePendencias pendencias={[pendencia()]} acaoDe={() => null} />);

    expect(screen.getByText('Enviar CNH')).toBeDefined();
    expect(screen.getByText('Vence amanhã')).toBeDefined();
  });

  it('a resolvida continua na lista, marcada', () => {
    // Sumir com ela faria o consultor pedir de novo o que o cliente já mandou.
    const { container } = render(
      <ListaDePendencias
        pendencias={[pendencia({ resolvida: true, tom: 'bom', prazo: 'Resolvida' })]}
        acaoDe={() => null}
      />,
    );

    expect(screen.getByText('Enviar CNH')).toBeDefined();
    expect(container.querySelector('li[data-resolvida]')).not.toBeNull();
  });

  it('o tom vem do domínio, não do componente', () => {
    const { container } = render(
      <ListaDePendencias pendencias={[pendencia({ tom: 'critico' })]} acaoDe={() => null} />,
    );

    expect(container.querySelector('.estado[data-tom="critico"]')).not.toBeNull();
  });

  it('a ação de cada item vem de fora', () => {
    render(
      <ListaDePendencias
        pendencias={[pendencia()]}
        acaoDe={(p) => <button>Resolver {p.descricao}</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Resolver Enviar CNH' })).toBeDefined();
  });

  it('sem pendência, diz que nada trava a oportunidade', () => {
    render(<ListaDePendencias pendencias={[]} acaoDe={() => null} />);

    expect(screen.getByText('Nenhuma pendência.')).toBeDefined();
  });
});
