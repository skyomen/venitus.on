// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Botao } from './botao';

describe('Botao', () => {
  it('usa a variante secundária por padrão', () => {
    render(<Botao>Ver Carteira</Botao>);
    expect(screen.getByRole('button').className).toContain('botao--secundario');
  });

  it.each(['primario', 'secundario', 'discreto', 'perigo'] as const)(
    'aplica a variante %s',
    (variante) => {
      render(<Botao variante={variante}>Ação</Botao>);
      expect(screen.getByRole('button').className).toContain(`botao--${variante}`);
    },
  );

  it('ocupa a largura toda quando pedido', () => {
    render(<Botao largo>Entrar</Botao>);
    expect(screen.getByRole('button').className).toContain('botao--largo');
  });

  it('continua clicável durante o envio, sem sumir da tela', () => {
    // Desabilitar antes da requisição começar esconde o erro de validação de
    // quem precisa vê-lo.
    render(<Botao enviando>Salvando…</Botao>);
    const botao = screen.getByRole('button');

    expect(botao.getAttribute('data-estado')).toBe('enviando');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.hasAttribute('disabled')).toBe(false);
  });

  it('em repouso não anuncia ocupado', () => {
    render(<Botao>Entrar</Botao>);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull();
    expect(screen.getByRole('button').getAttribute('data-estado')).toBeNull();
  });

  it('repassa atributos nativos', () => {
    const aoClicar = vi.fn();
    render(
      <Botao type="submit" onClick={aoClicar} disabled>
        Enviar
      </Botao>,
    );
    const botao = screen.getByRole('button');
    expect(botao.getAttribute('type')).toBe('submit');
    expect(botao.hasAttribute('disabled')).toBe(true);
  });
});
