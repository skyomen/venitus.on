'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/dados/cliente-servidor';
import { obterSessao } from '@/seguranca/sessao';
import { rotaInicialDe } from '@/seguranca/autorizacao';

export interface EstadoMfaFormulario {
  readonly erro: string | null;
}

/** Código TOTP: seis dígitos, sem espaço nem separador. */
function interpretarCodigo(valor: unknown): string | null {
  if (typeof valor !== 'string') {
    return null;
  }
  const limpo = valor.replace(/\s/g, '');
  return /^\d{6}$/.test(limpo) ? limpo : null;
}

async function concluir(fatorId: string, codigo: string): Promise<string | null> {
  const supabase = await criarClienteServidor();

  const desafio = await supabase.auth.mfa.challenge({ factorId: fatorId });
  if (desafio.error !== null) {
    return 'Não foi possível validar o código agora.';
  }

  const verificacao = await supabase.auth.mfa.verify({
    factorId: fatorId,
    challengeId: desafio.data.id,
    code: codigo,
  });

  return verificacao.error === null ? null : 'Código inválido.';
}

export async function confirmarFator(
  _anterior: EstadoMfaFormulario,
  dados: FormData,
): Promise<EstadoMfaFormulario> {
  const codigo = interpretarCodigo(dados.get('codigo'));
  const fatorId = dados.get('fator');

  if (codigo === null || typeof fatorId !== 'string' || fatorId === '') {
    return { erro: 'Código inválido.' };
  }

  const erro = await concluir(fatorId, codigo);
  if (erro !== null) {
    return { erro };
  }

  const sessao = await obterSessao();
  redirect(sessao === null ? '/entrar' : rotaInicialDe(sessao.papel));
}
