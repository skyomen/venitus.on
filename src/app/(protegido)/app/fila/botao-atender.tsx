'use client';

import { useActionState } from 'react';
import { Aviso } from '@/componentes/base/aviso';
import { Botao } from '@/componentes/base/botao';
import { atenderProximo } from './acoes';
import type { EstadoDaFila } from './acoes';

const INICIAL: EstadoDaFila = { aviso: null };

/**
 * A única ação da fila.
 *
 * Client Component apenas para mostrar o estado de envio e o aviso de fila
 * vazia. Nenhum dado do servidor atravessa a fronteira aqui — o formulário não
 * carrega nem o id do cliente, porque quem escolhe é a fila.
 */
export function BotaoAtender() {
  const [estado, acao, enviando] = useActionState(atenderProximo, INICIAL);

  return (
    <form action={acao} className="acao-da-fila">
      <Botao type="submit" variante="primario" largo enviando={enviando}>
        {enviando ? 'Puxando…' : 'Atender próximo cliente'}
      </Botao>

      {estado.aviso !== null && <Aviso>{estado.aviso}</Aviso>}
    </form>
  );
}
