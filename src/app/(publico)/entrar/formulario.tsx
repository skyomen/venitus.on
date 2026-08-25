'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/base/botao';
import { Campo } from '@/componentes/base/campo';
import { entrar } from './acoes';
import type { EstadoLogin } from './acoes';

const INICIAL: EstadoLogin = { erro: null };

/**
 * O formulário é Client Component só para mostrar o erro e o estado de envio.
 * Ele não recebe dado do servidor — não há DTO aqui porque não há o que vazar.
 */
export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState(entrar, INICIAL);

  return (
    <form action={acao} className="formulario">
      <Campo
        id="email"
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        spellCheck={false}
        required
        autoFocus
      />

      <Campo
        id="senha"
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        required
        {...(estado.erro !== null ? { erro: estado.erro } : {})}
      />

      <Botao type="submit" variante="primario" largo enviando={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </Botao>
    </form>
  );
}
