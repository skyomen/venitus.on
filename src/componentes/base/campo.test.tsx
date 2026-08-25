// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Campo } from './campo';

describe('Campo', () => {
  it('liga o rótulo ao controle', () => {
    render(<Campo id="email" rotulo="E-mail" name="email" />);
    expect(screen.getByLabelText('E-mail')).toBeDefined();
  });

  it('não marca erro nem descrição quando não há nenhum', () => {
    render(<Campo id="email" rotulo="E-mail" />);
    const campo = screen.getByLabelText('E-mail');

    expect(campo.getAttribute('aria-invalid')).toBeNull();
    expect(campo.getAttribute('aria-describedby')).toBeNull();
  });

  it('anuncia o erro e aponta o controle para ele', () => {
    render(<Campo id="cep" rotulo="CEP" erro="CEP tem 8 dígitos." />);
    const campo = screen.getByLabelText('CEP');

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toContain('cep-erro');
    expect(screen.getByRole('alert').textContent).toBe('CEP tem 8 dígitos.');
  });

  it('associa a dica ao controle', () => {
    render(<Campo id="email" rotulo="E-mail" dica="Usamos para enviar a apólice." />);
    expect(screen.getByLabelText('E-mail').getAttribute('aria-describedby')).toContain(
      'email-dica',
    );
  });

  it('descreve pelos dois quando há erro e dica', () => {
    render(<Campo id="cep" rotulo="CEP" dica="Só números." erro="Faltou um dígito." />);
    const descricao = screen.getByLabelText('CEP').getAttribute('aria-describedby') ?? '';

    expect(descricao).toContain('cep-erro');
    expect(descricao).toContain('cep-dica');
  });

  it('repassa atributos que abrem o teclado certo no celular', () => {
    render(<Campo id="cep" rotulo="CEP" inputMode="numeric" autoComplete="postal-code" />);
    const campo = screen.getByLabelText('CEP');

    expect(campo.getAttribute('inputmode')).toBe('numeric');
    expect(campo.getAttribute('autocomplete')).toBe('postal-code');
  });
});
