// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MedidorDeIntencao } from './medidor-intencao';

describe('MedidorDeIntencao', () => {
  it.each([
    ['FRIA', 'Fria', 1],
    ['MORNA', 'Morna', 2],
    ['QUENTE', 'Quente', 3],
  ] as const)('%s enche %i traço(s) e diz a palavra', (intencao, palavra, nivel) => {
    const { container } = render(<MedidorDeIntencao intencao={intencao} />);

    expect(screen.getByText(palavra)).toBeDefined();
    expect(container.querySelectorAll('.medidor-traco[data-aceso]')).toHaveLength(nivel);
  });

  it('sempre desenha os três traços, acesos ou não', () => {
    // O medidor precisa mostrar o quanto falta, não só o quanto tem.
    const { container } = render(<MedidorDeIntencao intencao="FRIA" />);
    expect(container.querySelectorAll('.medidor-traco')).toHaveLength(3);
  });

  it('os traços são decorativos: quem lê por leitor de tela ouve a palavra', () => {
    const { container } = render(<MedidorDeIntencao intencao="QUENTE" />);
    expect(container.querySelector('.medidor-tracos')?.getAttribute('aria-hidden')).toBe('true');
  });
});
