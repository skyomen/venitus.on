// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MolduraArea } from './moldura-area';

const MENU = [
  { rotulo: 'Início', destino: '/app/inicio' },
  { rotulo: 'Clientes', destino: '/app/clientes' },
];

function montar(modo: Parameters<typeof MolduraArea>[0]['modo'] = 'sintetico') {
  return render(
    <MolduraArea
      titulo="Venitus.on"
      nome="consultor@alfa.local"
      modo={modo}
      menu={MENU}
      seletorTema={<button type="button">Claro</button>}
      acaoSair={vi.fn()}
    >
      <p>conteúdo</p>
    </MolduraArea>,
  );
}

describe('MolduraArea', () => {
  it('mostra título, identificação e conteúdo', () => {
    montar();
    expect(screen.getByText('Venitus.on')).toBeDefined();
    expect(screen.getByText('consultor@alfa.local')).toBeDefined();
    expect(screen.getByText('conteúdo')).toBeDefined();
  });

  it('rende o menu como navegação acessível', () => {
    montar();
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(menu).toBeDefined();
    expect(screen.getByRole('link', { name: 'Clientes' }).getAttribute('href')).toBe(
      '/app/clientes',
    );
  });

  it('anuncia o modo de dados ativo', () => {
    montar('espelho');
    const faixa = screen.getByRole('status');
    expect(faixa.textContent).toContain('anonimizados');
    expect(faixa.getAttribute('data-modo')).toBe('espelho');
  });

  it('deixa o modo de leitura de produção evidente', () => {
    montar('producao-leitura');
    expect(screen.getByRole('status').textContent).toContain('PRODUÇÃO');
  });

  it('oferece a saída como botão de formulário', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeDefined();
  });

  it('reserva o lugar do seletor de tema sem conhecê-lo', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Claro' })).toBeDefined();
  });

  it('aplica a densidade compacta quando pedida', () => {
    const { container } = render(
      <MolduraArea
        titulo="Venitus.on"
        nome="gestor@alfa.local"
        modo="sintetico"
        menu={MENU}
        densidade="compacta"
        acaoSair={vi.fn()}
      >
        <p>conteúdo</p>
      </MolduraArea>,
    );
    expect(container.querySelector('[data-densidade="compacta"]')).not.toBeNull();
  });
});
