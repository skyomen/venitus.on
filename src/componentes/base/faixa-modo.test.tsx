// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MODOS } from '@/seguranca/modo-dados';
import { FaixaModo } from './faixa-modo';

describe('FaixaModo', () => {
  it.each(MODOS)('anuncia o modo %s', (modo) => {
    const { container } = render(<FaixaModo modo={modo} />);

    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(0);
    expect(container.querySelector(`[data-modo="${modo}"]`)).not.toBeNull();
  });

  it('deixa a leitura de produção evidente', () => {
    render(<FaixaModo modo="producao-leitura" />);
    expect(screen.getByRole('status').textContent).toContain('PRODUÇÃO');
  });
});
