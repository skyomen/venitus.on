'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/base/botao';
import { Campo } from '@/componentes/base/campo';
import { confirmarFator } from './acoes';
import type { EstadoMfaFormulario } from './acoes';

const INICIAL: EstadoMfaFormulario = { erro: null };

export function FormularioCodigo({ fatorId }: { readonly fatorId: string }) {
  const [estado, acao, enviando] = useActionState(confirmarFator, INICIAL);

  return (
    <form action={acao} className="formulario">
      <input type="hidden" name="fator" value={fatorId} />

      <Campo
        id="codigo"
        rotulo="Código do aplicativo"
        name="codigo"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        dica="Seis dígitos, sem espaço."
        {...(estado.erro !== null ? { erro: estado.erro } : {})}
      />

      <Botao type="submit" variante="primario" largo enviando={enviando}>
        {enviando ? 'Confirmando…' : 'Confirmar'}
      </Botao>
    </form>
  );
}
