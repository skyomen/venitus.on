'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { COOKIE_TEMA, interpretarTema, proximoTema } from './tema';

/**
 * Alterna o tema e guarda a escolha.
 *
 * O cookie não é de sessão: a preferência sobrevive ao logout, porque ela é da
 * pessoa e do aparelho, não do acesso.
 */
export async function alternarTema(): Promise<void> {
  const armazem = await cookies();
  const atual = interpretarTema(armazem.get(COOKIE_TEMA)?.value);

  armazem.set(COOKIE_TEMA, proximoTema(atual), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
}
