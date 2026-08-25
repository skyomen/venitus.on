import { ehPapel } from './autorizacao';
import type { Papel } from './autorizacao';

/** O que o servidor sabe sobre quem está pedindo. Nada além disto chega às telas. */
export interface Perfil {
  readonly usuarioId: string;
  readonly email: string;
  readonly papel: Papel;
  readonly corretoraId: string | null;
}

/**
 * Os claims do access token, como o hook os montou.
 *
 * Atenção ao que **não** serve aqui: o objeto `user` devolvido por `signInWithPassword`
 * e por `getUser()` carrega o `app_metadata` gravado na tabela de usuários do Auth,
 * e não os claims que o hook injeta no token. Ler dali devolve um `app_metadata` sem
 * `papel` — e todo login vira "credenciais inválidas".
 */
export interface ClaimsToken {
  readonly sub?: unknown;
  readonly email?: unknown;
  readonly app_metadata?: unknown;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Traduz os claims do token no perfil que a aplicação usa.
 *
 * Puro de propósito: é aqui que mora a decisão de fail closed, e decisão de
 * segurança precisa ser testável sem servidor, sem banco e sem rede.
 *
 * A fonte é o token porque é o token que a RLS enxerga. Ler o papel de outro
 * lugar abriria a porta para a aplicação permitir o que o banco depois nega.
 */
export function interpretarPerfil(claims: ClaimsToken | null | undefined): Perfil | null {
  if (claims === null || claims === undefined) {
    return null;
  }

  const metadados = (
    typeof claims.app_metadata === 'object' && claims.app_metadata !== null
      ? claims.app_metadata
      : {}
  ) as Record<string, unknown>;

  const papel = metadados['papel'];
  const usuarioId = texto(claims.sub);

  // Papel ausente ou desconhecido não vira acesso parcial: vira ausência de perfil.
  if (!ehPapel(papel) || usuarioId === null) {
    return null;
  }

  return {
    usuarioId,
    email: texto(claims.email) ?? '',
    papel,
    // O PLATFORM_ADMIN legitimamente não tem corretora (D10).
    corretoraId: texto(metadados['corretora_id']),
  };
}
