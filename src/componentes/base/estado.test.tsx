// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TONS_DE_ESTADO } from '@/design/tom';
import { Estado } from './estado';

describe('Estado', () => {
  it('nomeia o estado, não a categoria', () => {
    render(<Estado tom="atencao">Confirmar CEP</Estado>);
    expect(screen.getByText('Confirmar CEP')).toBeDefined();
  });

  it.each(TONS_DE_ESTADO)('o tom %s tem marcador próprio', (tom) => {
    // A forma carrega o significado junto com a cor: quem não distingue matiz
    // lê o marcador e o texto.
    const { container } = render(<Estado tom={tom}>Texto</Estado>);
    expect(container.querySelector(`.estado[data-tom="${tom}"]`)).not.toBeNull();
  });

  it('não é cápsula: nenhum elemento de fundo arredondado', () => {
    // Design system §9. O marcador é `::before`, que não entra no DOM.
    const { container } = render(<Estado tom="bom">Emitida</Estado>);
    expect(container.querySelector('.estado')?.children).toHaveLength(1);
  });
});
