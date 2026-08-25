/**
 * A matriz de autorização de rotas, em um lugar só.
 *
 * Blueprint §5.2 e §5.3. Este módulo é puro de propósito: ele decide, não busca.
 * Quem busca é o chamador, que passa o papel já resolvido a partir do token.
 *
 * Isto é conveniência de roteamento, não a muralha. A autorização real acontece
 * no Server Component, na Server Action e na RLS (§4.1, V13).
 */

export const PAPEIS = ['PLATFORM_ADMIN', 'GESTOR', 'CONSULTOR'] as const;

export type Papel = (typeof PAPEIS)[number];

export const ROTA_LOGIN = '/entrar';
export const ROTA_SEM_PERMISSAO = '/sem-permissao';

/** Cada papel tem uma área e só uma. Áreas não se sobrepõem. */
const AREA_POR_PAPEL: Readonly<Record<Papel, string>> = {
  PLATFORM_ADMIN: '/admin',
  GESTOR: '/gestor',
  CONSULTOR: '/app',
};

const ROTAS_PUBLICAS: readonly string[] = [ROTA_LOGIN, ROTA_SEM_PERMISSAO];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}

export function areaDe(papel: Papel): string {
  return AREA_POR_PAPEL[papel];
}

/** Para onde o login manda cada papel. */
export function rotaInicialDe(papel: Papel): string {
  return `${AREA_POR_PAPEL[papel]}/inicio`;
}

export function ehRotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));
}

const AREA_SESSAO = '/mfa';

/** Rota que exige sessão sem pertencer à área de um papel. */
export function ehRotaDeSessao(caminho: string): boolean {
  return caminho === AREA_SESSAO || caminho.startsWith(`${AREA_SESSAO}/`);
}

/** Uma rota é protegida quando pertence à área de algum papel. */
export function ehRotaProtegida(caminho: string): boolean {
  return Object.values(AREA_POR_PAPEL).some(
    (area) => caminho === area || caminho.startsWith(`${area}/`),
  );
}

export function podeAcessar(papel: Papel, caminho: string): boolean {
  const area = AREA_POR_PAPEL[papel];
  return caminho === area || caminho.startsWith(`${area}/`);
}

export type Decisao =
  { readonly tipo: 'seguir' } | { readonly tipo: 'redirecionar'; readonly destino: string };

const SEGUIR: Decisao = { tipo: 'seguir' };

/**
 * A decisão de roteamento para uma requisição.
 *
 * Fail closed: rota protegida sem papel vai para o login. Papel fora da própria
 * área vai para `/sem-permissao` — nunca para a área alheia, que só revelaria
 * a existência dela.
 */
export function decidirRota(papel: Papel | null, caminho: string): Decisao {
  // As telas de segundo fator ficam fora das áreas: exigem sessão, mas não
  // pertencem a papel nenhum — é justamente nelas que a sessão está incompleta.
  if (ehRotaDeSessao(caminho)) {
    return papel === null ? { tipo: 'redirecionar', destino: ROTA_LOGIN } : SEGUIR;
  }

  if (ehRotaPublica(caminho)) {
    // Quem já entrou não fica preso na tela de login.
    return papel !== null && caminho === ROTA_LOGIN
      ? { tipo: 'redirecionar', destino: rotaInicialDe(papel) }
      : SEGUIR;
  }

  if (!ehRotaProtegida(caminho)) {
    return SEGUIR;
  }

  if (papel === null) {
    return { tipo: 'redirecionar', destino: ROTA_LOGIN };
  }

  return podeAcessar(papel, caminho)
    ? SEGUIR
    : { tipo: 'redirecionar', destino: ROTA_SEM_PERMISSAO };
}
