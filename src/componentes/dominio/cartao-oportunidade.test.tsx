// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CartaoDeOportunidade } from '@/nucleo/fila/cartao';
import { CartaoOportunidade } from './cartao-oportunidade';

function cartao(ajuste: Partial<CartaoDeOportunidade> = {}): CartaoDeOportunidade {
  return {
    id: 'oportunidade-1',
    nome: 'Marina Duarte',
    veiculo: 'Chevrolet Tracker Premier 2024',
    intencao: 'QUENTE',
    espera: { minutos: 4, texto: '4 min', tom: 'neutro' },
    fatos: [
      { rotulo: 'Maior preocupação', valor: 'Roubo e furto' },
      { rotulo: 'Cotação', valor: 'Realizada' },
    ],
    pendencia: { texto: 'Confirmar CEP', tom: 'atencao' },
    ...ajuste,
  };
}

describe('CartaoOportunidade', () => {
  it('abre com quem é o cliente e qual é o carro', () => {
    render(<CartaoOportunidade cartao={cartao()} acao={<button>Atender</button>} />);

    expect(screen.getByRole('heading', { name: 'Marina Duarte' })).toBeDefined();
    expect(screen.getByText('Chevrolet Tracker Premier 2024')).toBeDefined();
  });

  it('mostra a temperatura e cada fato de §9.5', () => {
    render(<CartaoOportunidade cartao={cartao()} acao={null} />);

    expect(screen.getByText('Quente')).toBeDefined();
    expect(screen.getByText('Maior preocupação')).toBeDefined();
    expect(screen.getByText('Roubo e furto')).toBeDefined();
    expect(screen.getByText('Realizada')).toBeDefined();
  });

  it('a pendência aparece como estado, com o tom que veio do domínio', () => {
    const { container } = render(<CartaoOportunidade cartao={cartao()} acao={null} />);

    expect(screen.getByText('Confirmar CEP')).toBeDefined();
    expect(container.querySelector('.estado[data-tom="atencao"]')).not.toBeNull();
  });

  it('sem pendência, a linha some em vez de ficar vazia', () => {
    render(<CartaoOportunidade cartao={cartao({ pendencia: null })} acao={null} />);
    expect(screen.queryByText('Pendência')).toBeNull();
  });

  it('sem veículo cadastrado, não sobra linha em branco', () => {
    render(<CartaoOportunidade cartao={cartao({ veiculo: null })} acao={null} />);
    expect(screen.queryByText(/Tracker/)).toBeNull();
  });

  it('o tempo na fila entra sempre, com o tom da espera', () => {
    const { container } = render(
      <CartaoOportunidade
        cartao={cartao({ espera: { minutos: 200, texto: '3 h', tom: 'critico' } })}
        acao={null}
      />,
    );

    expect(screen.getByText('3 h')).toBeDefined();
    expect(container.querySelector('.estado[data-tom="critico"]')).not.toBeNull();
  });

  it('a ação vem de fora: o cartão não decide o que fazer com o cliente', () => {
    render(<CartaoOportunidade cartao={cartao()} acao={<button>Atender cliente</button>} />);
    expect(screen.getByRole('button', { name: 'Atender cliente' })).toBeDefined();
  });

  it('cada cartão é uma região nomeada pelo cliente', () => {
    // Navegar por regiões é como quem usa leitor de tela percorre uma lista.
    render(<CartaoOportunidade cartao={cartao()} acao={null} />);
    expect(screen.getByRole('article', { name: 'Marina Duarte' })).toBeDefined();
  });
});
