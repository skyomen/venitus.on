/**
 * Teste estrutural gerado do catálogo do Postgres.
 *
 * Blueprint §21.1: ele não tem lista fixa de tabelas. Ele pergunta ao banco quais
 * existem e cobra de cada uma a checklist de §6.4. Tabela nova sem policy quebra
 * o pipeline em vez de passar despercebida — é esse o ponto.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { consultar, encerrarConexao } from '../apoio/ambiente';

interface Tabela extends Record<string, unknown> {
  nome: string;
  rls_habilitado: boolean;
  rls_forcado: boolean;
  comentario: string | null;
}

const tabelas = await consultar<Tabela>(`
  select c.relname                       as nome,
         c.relrowsecurity                as rls_habilitado,
         c.relforcerowsecurity           as rls_forcado,
         obj_description(c.oid, 'pg_class') as comentario
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`);

function categoriaDe(tabela: Tabela): string | null {
  const encontrado = /categoria=(\w+)/.exec(tabela.comentario ?? '');
  return encontrado?.[1] ?? null;
}

/** A corretora é o próprio tenant: a coluna de tenant dela é a chave primária. */
function colunaDeTenant(tabela: Tabela): string {
  return /tenant=id\b/.test(tabela.comentario ?? '') ? 'id' : 'corretora_id';
}

afterAll(encerrarConexao);

describe('catálogo de tabelas', () => {
  it('encontrou tabelas para verificar', () => {
    expect(tabelas.length).toBeGreaterThan(0);
  });

  it.each(tabelas.map((t) => [t.nome, t] as const))('%s declara sua categoria', (_nome, tabela) => {
    expect(categoriaDe(tabela)).toBeOneOf(['dominio', 'catalogo', 'plataforma']);
  });

  it.each(tabelas.map((t) => [t.nome, t] as const))(
    '%s tem RLS habilitado e forçado',
    (_nome, tabela) => {
      expect(tabela.rls_habilitado, 'RLS não habilitado').toBe(true);
      // Sem `force`, o dono da tabela escapa das policies.
      expect(tabela.rls_forcado, 'RLS não forçado').toBe(true);
    },
  );

  it.each(tabelas.map((t) => [t.nome, t] as const))('%s tem ao menos uma policy', async (nome) => {
    const policies = await consultar(
      `select polname from pg_policy p
      join pg_class c on c.oid = p.polrelid where c.relname = $1`,
      [nome],
    );
    expect(policies.length).toBeGreaterThan(0);
  });
});

const dominio = tabelas.filter((t) => categoriaDe(t) === 'dominio');

describe('tabelas de domínio', () => {
  it('existem tabelas de domínio', () => {
    expect(dominio.length).toBeGreaterThan(0);
  });

  it.each(dominio.map((t) => [t.nome, t] as const))(
    '%s carrega a coluna de tenant',
    async (nome, tabela) => {
      const colunas = await consultar(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [nome, colunaDeTenant(tabela)],
      );
      expect(colunas.length, `falta ${colunaDeTenant(tabela)}`).toBe(1);
    },
  );

  it.each(dominio.map((t) => [t.nome, t] as const))(
    '%s tem índice na coluna de tenant',
    async (nome, tabela) => {
      // Policy é predicado: sem índice, ela vira varredura completa.
      const indices = await consultar(
        `select i.indexrelid::regclass::text as nome
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
         where c.relname = $1 and a.attname = $2`,
        [nome, colunaDeTenant(tabela)],
      );
      expect(indices.length, `sem índice em ${colunaDeTenant(tabela)}`).toBeGreaterThan(0);
    },
  );

  it.each(dominio.map((t) => [t.nome] as const))(
    '%s não tem policy mencionando PLATFORM_ADMIN',
    async (nome) => {
      // D10 / §6.7: uma linha dessas em cada tabela transforma um token
      // comprometido em acesso a todas as corretoras.
      const policies = await consultar<{ definicao: string | null }>(
        `select pg_get_expr(p.polqual, p.polrelid) as definicao
         from pg_policy p join pg_class c on c.oid = p.polrelid
         where c.relname = $1`,
        [nome],
      );
      for (const policy of policies) {
        expect(policy.definicao ?? '').not.toContain('PLATFORM_ADMIN');
      }
    },
  );
});

describe('policies de escrita', () => {
  it('toda policy de escrita valida a linha gravada com WITH CHECK', async () => {
    // O `using` filtra o que se enxerga; só o `with check` impede gravar em outro
    // tenant. Uma policy de escrita sem ele deixa a porta de saída aberta (§6.2).
    const semCheck = await consultar<{ tabela: string; policy: string }>(`
      select c.relname as tabela, p.polname as policy
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and p.polcmd in ('a', 'w', '*')   -- insert, update, all
        and p.polpermissive
        and p.polwithcheck is null
    `);
    expect(semCheck).toEqual([]);
  });
});

describe('privilégios padrão', () => {
  it('o papel anon não alcança nenhuma tabela do schema public', async () => {
    const alcancaveis = await consultar<{ nome: string }>(`
      select c.relname as nome
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    `);
    expect(alcancaveis.map((t) => t.nome)).toEqual([]);
  });

  it('authenticated não pode alterar papel nem corretora do próprio usuário', async () => {
    // RLS não filtra coluna; o recorte é por GRANT de coluna.
    const permitidas = await consultar<{ coluna: string }>(`
      select column_name as coluna
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'usuario'
        and grantee = 'authenticated' and privilege_type = 'UPDATE'
      order by column_name
    `);
    expect(permitidas.map((c) => c.coluna)).toEqual(['nome', 'telefone']);
  });
});
