'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/dados/cliente-servidor';

export interface EstadoDaFila {
  readonly aviso: string | null;
}

/**
 * Puxa a próxima oportunidade da fila para quem está pedindo.
 *
 * Nenhum identificador vem do formulário: a função do banco resolve o consultor
 * por `auth.uid()`. Aceitar o id pela requisição deixaria um consultor atribuir
 * trabalho a outro — ou a si mesmo na corretora alheia.
 *
 * Fila vazia, capacidade cheia e papel errado devolvem a mesma coisa: não há
 * nada para você agora. Nenhum dos três é erro.
 */
export async function atenderProximo(): Promise<EstadoDaFila> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc('assumir_proxima_da_fila');

  if (error !== null) {
    return { aviso: 'Não foi possível puxar o próximo cliente. Tente de novo em instantes.' };
  }

  // O PostgREST expande composto nulo num objeto de campos nulos: testar
  // `data === null` daria sempre falso, e a fila vazia passaria por sucesso.
  const oportunidade = data as { id?: string | null } | null;

  if (oportunidade?.id === undefined || oportunidade.id === null) {
    return { aviso: 'Nenhum cliente disponível para você agora.' };
  }

  revalidatePath('/app/fila');
  revalidatePath('/app/atendimentos');
  revalidatePath('/app/inicio');

  return { aviso: null };
}
