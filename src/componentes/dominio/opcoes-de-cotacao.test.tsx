// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OpcaoNaTela } from '@/nucleo/atendimento/painel';
import { OpcoesDeCotacao } from './opcoes-de-cotacao';

function opcao(ajuste: Partial<OpcaoNaTela> = {}): OpcaoNaTela {
  return {
    id: 'o1',
    nomePlano: 'Compreensiva',
    seguradora: 'Seguradora Piloto',
    premio: 'R$ 2.400,00',
    franquia: 'R$ 3.500,00',
    escolhida: false,
    ...ajuste,
  };
}

describe('OpcoesDeCotacao', () => {
  it('mostra plano, seguradora, prêmio e franquia', () => {
    render(<OpcoesDeCotacao opcoes={[opcao()]} acaoDe={() => null} />);

    expect(screen.getByText('Compreensiva')).toBeDefined();
    expect(screen.getByText('Seguradora Piloto')).toBeDefined();
    expect(screen.getByText('R$ 2.400,00')).toBeDefined();
    expect(screen.getByText('R$ 3.500,00')).toBeDefined();
  });

  it('a escolhida é dita por texto, não só por cor', () => {
    const { container } = render(
      <OpcoesDeCotacao opcoes={[opcao({ escolhida: true })]} acaoDe={() => null} />,
    );

    expect(screen.getByText('Plano de interesse do cliente')).toBeDefined();
    expect(container.querySelector('li[data-escolhida]')).not.toBeNull();
  });

  it('a não escolhida não recebe a marca', () => {
    const { container } = render(<OpcoesDeCotacao opcoes={[opcao()]} acaoDe={() => null} />);

    expect(screen.queryByText('Plano de interesse do cliente')).toBeNull();
    expect(container.querySelector('li[data-escolhida]')).toBeNull();
  });

  it('preserva a ordem que o domínio decidiu', () => {
    render(
      <OpcoesDeCotacao
        opcoes={[opcao({ id: 'a', nomePlano: 'Essencial' }), opcao({ id: 'b' })]}
        acaoDe={() => null}
      />,
    );

    const planos = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(planos[0]).toContain('Essencial');
  });

  it('a ação de cada opção vem de fora', () => {
    render(<OpcoesDeCotacao opcoes={[opcao()]} acaoDe={(o) => <button>{o.nomePlano}</button>} />);

    expect(screen.getByRole('button', { name: 'Compreensiva' })).toBeDefined();
  });

  it('sem opção, diz o que vai preencher a lista', () => {
    render(<OpcoesDeCotacao opcoes={[]} acaoDe={() => null} />);

    expect(screen.getByText('Nenhuma opção retornada.')).toBeDefined();
  });
});
