/**
 * Validação de entrada do login.
 *
 * Separado da Server Action para poder ser testado sem servidor, sem banco e sem
 * rede — que é o que sustenta os 98% sem inflar (blueprint §20.5).
 */

export interface Credenciais {
  readonly email: string;
  readonly password: string;
}

/** Curto o bastante para não recusar senha legítima, longo o bastante para barrar lixo. */
const TAMANHO_MAXIMO = 200;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Devolve `null` para qualquer entrada inválida, sem dizer qual campo falhou.
 *
 * O chamador responde sempre "Credenciais inválidas": distinguir os casos daria
 * a quem tenta adivinhar um oráculo de e-mails existentes (§4.1, V12).
 */
export function interpretarCredenciais(email: unknown, senha: unknown): Credenciais | null {
  if (typeof email !== 'string' || typeof senha !== 'string') {
    return null;
  }

  const emailNormalizado = email.trim().toLowerCase();

  if (emailNormalizado.length === 0 || emailNormalizado.length > TAMANHO_MAXIMO) {
    return null;
  }
  if (!FORMATO_EMAIL.test(emailNormalizado)) {
    return null;
  }
  if (senha.length === 0 || senha.length > TAMANHO_MAXIMO) {
    return null;
  }

  return { email: emailNormalizado, password: senha };
}
