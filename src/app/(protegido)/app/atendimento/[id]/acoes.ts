'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor } from '@/dados/cliente-servidor';

export interface EstadoDoAtendimento {
  readonly erro: string | null;
}

const OK: EstadoDoAtendimento = { erro: null };

function texto(valor: FormDataEntryValue | null): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Os identificadores vêm do formulário, e isso é seguro **porque a função do
 * banco confere o dono** por `auth.uid()` antes de gravar.
 *
 * A alternativa — guardar o que pode ser tocado na sessão — moveria a
 * autorização para a aplicação, que é justamente onde ela não deve morar (§4.1).
 */
export async function resolverPendencia(
  _anterior: EstadoDoAtendimento,
  dados: FormData,
): Promise<EstadoDoAtendimento> {
  const pendencia = texto(dados.get('pendencia'));
  const oportunidade = texto(dados.get('oportunidade'));

  if (pendencia === null || oportunidade === null) {
    return { erro: 'Pendência não informada.' };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc('resolver_pendencia', { p_pendencia: pendencia });

  if (error !== null) {
    return { erro: 'Não foi possível resolver a pendência.' };
  }

  revalidatePath(`/app/atendimento/${oportunidade}`);
  return OK;
}

/** Marcar de novo o mesmo plano desmarca: desfazer é tão comum quanto escolher. */
export async function escolherPlano(
  _anterior: EstadoDoAtendimento,
  dados: FormData,
): Promise<EstadoDoAtendimento> {
  const oportunidade = texto(dados.get('oportunidade'));

  if (oportunidade === null) {
    return { erro: 'Oportunidade não informada.' };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc('marcar_plano_de_interesse', {
    p_oportunidade: oportunidade,
    p_opcao: texto(dados.get('opcao')),
  });

  if (error !== null) {
    return { erro: 'Não foi possível registrar o plano de interesse.' };
  }

  revalidatePath(`/app/atendimento/${oportunidade}`);
  revalidatePath('/app/atendimentos');
  return OK;
}
