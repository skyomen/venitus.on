// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aviso } from './aviso';

describe('Aviso', () => {
  it('informa sem interromper a leitura no tom neutro', () => {
    render(<Aviso>Tentamos de novo em 2 minutos.</Aviso>);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('interrompe a leitura no tom crítico', () => {
    // A falha precisa ser anunciada assim que aparece.
    render(<Aviso tom="critico">A cotação não foi enviada.</Aviso>);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('mostra o título quando há um', () => {
    render(
      <Aviso tom="critico" titulo="A cotação não foi enviada">
        A seguradora não respondeu.
      </Aviso>,
    );
    expect(screen.getByText('A cotação não foi enviada')).toBeDefined();
    expect(screen.getByText('A seguradora não respondeu.')).toBeDefined();
  });

  it('funciona sem título', () => {
    const { container } = render(<Aviso>Só o corpo.</Aviso>);
    expect(container.querySelector('.aviso-titulo')).toBeNull();
  });
});
