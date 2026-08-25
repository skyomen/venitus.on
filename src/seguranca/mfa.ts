import type { Papel } from './autorizacao';

/**
 * Segundo fator.
 *
 * Blueprint §4.4: obrigatório para `PLATFORM_ADMIN` e `GESTOR`. São os papéis que
 * enxergam a operação inteira de uma corretora ou o cadastro da plataforma — o
 * consultor enxerga a própria carteira, e exigir dele o mesmo atrito diário
 * cobraria caro por um risco menor.
 */

export const ROTA_MFA_CADASTRAR = '/mfa/cadastrar';
export const ROTA_MFA_VERIFICAR = '/mfa/verificar';
export const AREA_MFA = '/mfa';

/** Nível de garantia da sessão: `aal1` é senha; `aal2` é senha mais segundo fator. */
export type NivelGarantia = 'aal1' | 'aal2';

export type ExigenciaMfa = 'SEGUIR' | 'CADASTRAR' | 'VERIFICAR';

const PAPEIS_COM_MFA: readonly Papel[] = ['PLATFORM_ADMIN', 'GESTOR'];

export function papelExigeMfa(papel: Papel): boolean {
  return PAPEIS_COM_MFA.includes(papel);
}

export function ehRotaMfa(caminho: string): boolean {
  return caminho === AREA_MFA || caminho.startsWith(`${AREA_MFA}/`);
}

/**
 * A obrigatoriedade é ligada por ambiente.
 *
 * Em produção vale sempre. No desenvolvimento fica desligada por padrão: exigir
 * um código a cada login local atrapalharia sem proteger nada, já que os dados
 * são sintéticos. `MFA_OBRIGATORIA` força o comportamento nos dois sentidos, o
 * que é o que permite exercitá-la em teste.
 */
export function mfaObrigatoria(ambiente: string | undefined, forcada: string | undefined): boolean {
  if (forcada === 'sim') {
    return true;
  }
  if (forcada === 'nao') {
    return false;
  }
  return ambiente === 'production';
}

export interface EstadoMfa {
  readonly papel: Papel;
  readonly obrigatoria: boolean;
  readonly temFatorVerificado: boolean;
  readonly nivel: NivelGarantia;
}

/**
 * O que fazer antes de deixar entrar na área.
 *
 * Quem cadastrou um fator precisa usá-lo, independentemente do papel: um fator
 * cadastrado e ignorado é pior que nenhum, porque dá a impressão de proteção que
 * não existe.
 */
export function decidirMfa(estado: EstadoMfa): ExigenciaMfa {
  if (estado.temFatorVerificado) {
    return estado.nivel === 'aal2' ? 'SEGUIR' : 'VERIFICAR';
  }
  return estado.obrigatoria && papelExigeMfa(estado.papel) ? 'CADASTRAR' : 'SEGUIR';
}

export function rotaDaExigencia(exigencia: ExigenciaMfa): string | null {
  if (exigencia === 'CADASTRAR') {
    return ROTA_MFA_CADASTRAR;
  }
  if (exigencia === 'VERIFICAR') {
    return ROTA_MFA_VERIFICAR;
  }
  return null;
}
