-- =============================================================================
-- 001 — Tenant, identidade e catálogo da plataforma
--
-- Blueprint §6. A corretora é o tenant. Isolamento é estrutural: nenhuma
-- configuração, flag ou caminho de código pode desligá-lo.
--
-- Convenção obrigatória (§6.6): toda tabela declara sua categoria no comentário.
--   categoria=dominio     → carrega o tenant, leitura e escrita filtradas
--   categoria=catalogo    → comum a todas, leitura para autenticados
--   categoria=plataforma  → só service_role, ou PLATFORM_ADMIN sem PII
-- O teste de catálogo lê esses comentários. Tabela sem categoria reprova.
-- =============================================================================

create type public.papel_usuario as enum ('PLATFORM_ADMIN', 'GESTOR', 'CONSULTOR');
create type public.status_registro as enum ('ATIVO', 'INATIVO');

-- -----------------------------------------------------------------------------
-- Gatilho compartilhado de `atualizado_em`
-- -----------------------------------------------------------------------------
create or replace function public.tocar_atualizado_em() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- =============================================================================
-- CATÁLOGO DA PLATAFORMA
-- Sem corretora_id. Leitura para qualquer autenticado; escrita só por service_role.
-- =============================================================================

create table public.plano (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  limites jsonb not null default '{}'::jsonb,
  recursos jsonb not null default '{}'::jsonb,
  preco numeric(14, 2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.plano is 'categoria=catalogo; Planos comerciais da plataforma.';

create table public.seguradora (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  conector text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.seguradora is 'categoria=catalogo; Seguradoras suportadas.';

create table public.produto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ramo text not null,
  seguradora_id uuid not null references public.seguradora (id) on delete restrict,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.produto is 'categoria=catalogo; Produtos vendáveis.';
create index produto_seguradora_idx on public.produto (seguradora_id);

-- =============================================================================
-- DOMÍNIO
-- =============================================================================

create table public.corretora (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text not null,
  status public.status_registro not null default 'ATIVO',
  plano_id uuid references public.plano (id) on delete restrict,
  logo_url text,
  cor_primaria text,
  fuso_horario text not null default 'America/Sao_Paulo',
  configuracao jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- A corretora é o próprio tenant: a coluna de tenant aqui é a chave primária.
comment on table public.corretora is 'categoria=dominio; tenant=id; O tenant do sistema.';
create unique index corretora_documento_unico on public.corretora (documento);

create table public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  corretora_id uuid references public.corretora (id) on delete restrict,
  papel public.papel_usuario not null,
  nome text not null,
  email text not null,
  telefone text,
  capacidade_atendimento integer not null default 0 check (capacidade_atendimento >= 0),
  status public.status_registro not null default 'ATIVO',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- D9 garantida pela estrutura, não por índice: uma linha por usuário, um tenant.
  -- D10: o PLATFORM_ADMIN não pertence a corretora alguma, e por isso não alcança
  -- dado de cliente por nenhuma policy de domínio.
  constraint usuario_corretora_conforme_papel check (
    (papel = 'PLATFORM_ADMIN' and corretora_id is null)
    or (papel <> 'PLATFORM_ADMIN' and corretora_id is not null)
  )
);
comment on table public.usuario is 'categoria=dominio; Perfil ligado a auth.users. Um usuário, uma corretora.';
create index usuario_corretora_idx on public.usuario (corretora_id);
create unique index usuario_email_unico on public.usuario (lower(email));

create trigger corretora_atualizado_em before update on public.corretora
for each row execute function public.tocar_atualizado_em();
create trigger usuario_atualizado_em before update on public.usuario
for each row execute function public.tocar_atualizado_em();

-- =============================================================================
-- CLAIMS: o tenant vem do token, nunca da requisição (§6.1)
-- =============================================================================

-- Injeta corretora_id e papel no access token no momento da emissão.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_corretora uuid;
  v_papel text;
begin
  select u.corretora_id, u.papel::text
    into v_corretora, v_papel
  from public.usuario u
  where u.id = (event ->> 'user_id')::uuid
    and u.status = 'ATIVO';

  -- Usuário inexistente ou inativo sai sem claim: fail closed (§0.3).
  if v_papel is null then
    return event;
  end if;

  return jsonb_set(
    event,
    '{claims,app_metadata}',
    coalesce(event -> 'claims' -> 'app_metadata', '{}'::jsonb)
      || jsonb_build_object('corretora_id', v_corretora, 'papel', v_papel)
  );
end;
$$;

-- Sem claim válido, devolve NULL — e toda policy que compara com NULL nega.
create or replace function public.corretora_atual() returns uuid
language sql stable set search_path = '' as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'corretora_id',
    ''
  )::uuid;
$$;

create or replace function public.papel_atual() returns text
language sql stable set search_path = '' as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'papel',
    'NENHUM'
  );
$$;

-- =============================================================================
-- RLS — habilitado E forçado, para valer inclusive para o dono da tabela
-- =============================================================================

alter table public.plano enable row level security;
alter table public.plano force row level security;
alter table public.seguradora enable row level security;
alter table public.seguradora force row level security;
alter table public.produto enable row level security;
alter table public.produto force row level security;
alter table public.corretora enable row level security;
alter table public.corretora force row level security;
alter table public.usuario enable row level security;
alter table public.usuario force row level security;

-- Catálogo: leitura para autenticados. Escrita não tem policy — logo, não acontece.
create policy plano_leitura on public.plano for select to authenticated using (true);
create policy seguradora_leitura on public.seguradora for select to authenticated using (true);
create policy produto_leitura on public.produto for select to authenticated using (true);

-- Domínio: nenhuma policy menciona PLATFORM_ADMIN (D10, §6.7).
create policy corretora_leitura on public.corretora for select to authenticated
using (id = (select public.corretora_atual()));

create policy usuario_leitura on public.usuario for select to authenticated
using (
  id = (select auth.uid())
  or corretora_id = (select public.corretora_atual())
);

create policy usuario_alteracao_propria on public.usuario for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- O hook roda como supabase_auth_admin e precisa ler o perfil para montar o claim.
create policy usuario_leitura_auth_admin on public.usuario for select to supabase_auth_admin
using (true);

-- =============================================================================
-- PRIVILÉGIOS — fecha as portas padrão (§6.3)
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant select on public.plano, public.seguradora, public.produto to authenticated;
grant select on public.corretora to authenticated;
grant select on public.usuario to authenticated;

-- RLS não filtra coluna. Sem este recorte, o próprio usuário poderia se promover
-- a GESTOR ou se mudar de corretora — a policy de update só valida a linha.
grant update (nome, telefone) on public.usuario to authenticated;

grant execute on function public.corretora_atual() to authenticated;
grant execute on function public.papel_atual() to authenticated;

-- O hook é do GoTrue, de mais ninguém.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.usuario to supabase_auth_admin;
