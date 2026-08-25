'use client';

import { useActionState } from 'react';
import { entrar } from './acoes';
import type { EstadoLogin } from './acoes';

const INICIAL: EstadoLogin = { erro: null };

/**
 * O formulário é um Client Component só para mostrar o erro e o estado de envio.
 * Ele não recebe dado nenhum do servidor — não há DTO aqui porque não há o que
 * vazar (blueprint §4.3).
 */
export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState(entrar, INICIAL);

  return (
    <form action={acao} className="formulario">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
        inputMode="email"
      />

      <label htmlFor="senha">Senha</label>
      <input id="senha" name="senha" type="password" autoComplete="current-password" required />

      {estado.erro !== null && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
