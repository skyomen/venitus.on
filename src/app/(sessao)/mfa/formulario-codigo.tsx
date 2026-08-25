'use client';

import { useActionState } from 'react';
import { confirmarFator } from './acoes';
import type { EstadoMfaFormulario } from './acoes';

const INICIAL: EstadoMfaFormulario = { erro: null };

export function FormularioCodigo({ fatorId }: { fatorId: string }) {
  const [estado, acao, enviando] = useActionState(confirmarFator, INICIAL);

  return (
    <form action={acao} className="formulario">
      <input type="hidden" name="fator" value={fatorId} />

      <label htmlFor="codigo">Código do aplicativo</label>
      <input
        id="codigo"
        name="codigo"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
      />

      {estado.erro !== null && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Confirmando…' : 'Confirmar'}
      </button>
    </form>
  );
}
