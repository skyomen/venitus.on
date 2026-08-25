// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Placa } from './placa';

describe('Placa', () => {
  it('mostra valor e descrição', () => {
    render(<Placa valor="3" descricao="clientes quentes" />);
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('clientes quentes')).toBeDefined();
  });

  it('não marca tom quando o número não exige ação', () => {
    // Colorir tudo faz nada se destacar.
    const { container } = render(<Placa valor="6" descricao="aguardando" />);
    expect(container.querySelector('[data-tom]')).toBeNull();
  });

  it.each(['quente', 'atencao', 'bom'] as const)('marca o tom %s', (tom) => {
    const { container } = render(<Placa valor="2" descricao="pendências" tom={tom} />);
    expect(container.querySelector(`[data-tom="${tom}"]`)).not.toBeNull();
  });
});
