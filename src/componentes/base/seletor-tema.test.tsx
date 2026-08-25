// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TEMAS } from '@/design/tema';
import { SeletorTema } from './seletor-tema';

describe('SeletorTema', () => {
  it.each(TEMAS)('nomeia o tema em vigor (%s), não um destino', (tema) => {
    // Nomear o destino exigiria saber o que o sistema está mostrando, e um botão
    // que promete "Claro" com a tela já clara anuncia algo que não acontece.
    render(<SeletorTema tema={tema} aoAlternar={vi.fn()} />);
    expect(screen.getByRole('button').textContent?.toLowerCase()).toContain(tema);
  });

  it('anuncia onde está e para onde vai', () => {
    render(<SeletorTema tema="claro" aoAlternar={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Claro. Alternar para escuro.',
    );
  });

  it('envia por formulário, então funciona sem JavaScript', () => {
    render(<SeletorTema tema="sistema" aoAlternar={vi.fn()} />);
    const botao = screen.getByRole('button');

    expect(botao.getAttribute('type')).toBe('submit');
    expect(botao.closest('form')).not.toBeNull();
  });
});
