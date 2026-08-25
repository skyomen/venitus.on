-- =============================================================================
-- 004 — Plataforma restrita
--
-- Blueprint §7.6. Nenhuma destas tabelas é alcançável por usuário autenticado:
-- elas pertencem ao worker, que opera com `service_role`. Ainda assim carregam
-- RLS habilitado e forçado, e ficam sem policy para `authenticated` — assim, se
-- algum privilégio for concedido por engano no futuro, a RLS ainda nega.
-- =============================================================================

create type public.status_agendamento as enum ('PENDENTE', 'EXECUTADO', 'CANCELADO', 'FALHOU');
create type public.status_outbox as enum (
  'PENDENTE',
  'ENTREGUE',
  'FALHOU',
  'AGUARDANDO_CONECTOR'
);
create type public.estado_disjuntor as enum ('FECHADO', 'ABERTO', 'MEIO_ABERTO');

-- -----------------------------------------------------------------------------
-- Agendamento — a fila durável que sustenta as réguas (§11.3)
-- -----------------------------------------------------------------------------
create table public.agendamento (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  tipo text not null,
  executar_em timestamptz not null,
  status public.status_agendamento not null default 'PENDENTE',
  tentativas integer not null default 0,

  -- Impede duplicar o mesmo passo da mesma régua para a mesma oportunidade.
  chave_unicidade text not null unique,
  payload jsonb not null default '{}'::jsonb,
  executado_em timestamptz,
  criado_em timestamptz not null default now()
);
comment on table public.agendamento is 'categoria=plataforma; Fila durável de follow-up e renovação.';
create index agendamento_corretora_idx on public.agendamento (corretora_id);

-- O worker drena por esta ordem, com FOR UPDATE SKIP LOCKED.
create index agendamento_pendentes_idx on public.agendamento (executar_em)
  where status = 'PENDENTE';
create index agendamento_oportunidade_idx on public.agendamento (oportunidade_id)
  where status = 'PENDENTE';

-- -----------------------------------------------------------------------------
-- Integrações
-- -----------------------------------------------------------------------------
create table public.integracao_credencial (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  conector text not null,

  -- Criptografado em repouso, com chave distinta da de sessão (§13.2).
  -- Nunca volta a uma tela: a UI mostra estado, jamais o valor.
  segredo_cifrado bytea not null,
  status text not null default 'ATIVA',
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.integracao_credencial is 'categoria=plataforma; Credencial por corretora, cifrada.';
create index integracao_credencial_corretora_idx on public.integracao_credencial (corretora_id);
create unique index integracao_credencial_unica on public.integracao_credencial (corretora_id, conector);

create table public.integracao_outbox (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  oportunidade_id uuid references public.oportunidade (id) on delete cascade,
  destino text not null,
  operacao text not null,
  payload jsonb not null default '{}'::jsonb,

  -- Reexecutar não pode criar contato, oportunidade ou proposta em duplicidade.
  chave_idempotencia text not null unique,
  status public.status_outbox not null default 'PENDENTE',
  tentativas integer not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  ultimo_erro text,
  entregue_em timestamptz,
  criado_em timestamptz not null default now()
);
comment on table public.integracao_outbox is 'categoria=plataforma; Escritas pendentes para sistemas externos.';
create index integracao_outbox_corretora_idx on public.integracao_outbox (corretora_id);
create index integracao_outbox_pendentes_idx on public.integracao_outbox (proxima_tentativa_em)
  where status in ('PENDENTE', 'FALHOU');

-- Enquanto o conector real não existe, a intenção fica aqui, pronta para
-- reprocessar quando ele entrar (§10.5).
create index integracao_outbox_aguardando_idx on public.integracao_outbox (corretora_id, destino)
  where status = 'AGUARDANDO_CONECTOR';

create table public.integracao_evento (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  conector text not null,
  operacao text not null,
  -- Corpo já redigido pelo redator antes de chegar aqui (§15.2).
  requisicao jsonb,
  resposta jsonb,
  status_http integer,
  duracao_ms integer,
  sucesso boolean not null,
  ocorrido_em timestamptz not null default now()
);
comment on table public.integracao_evento is 'categoria=plataforma; Log de cada chamada externa, com PII redigida.';
create index integracao_evento_corretora_idx on public.integracao_evento (corretora_id);
create index integracao_evento_conector_idx on public.integracao_evento (corretora_id, conector, ocorrido_em desc);

create table public.integracao_saude (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  conector text not null,
  estado public.estado_disjuntor not null default 'FECHADO',
  falhas_consecutivas integer not null default 0,
  aberto_em timestamptz,
  ultima_verificacao timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.integracao_saude is 'categoria=plataforma; Estado do disjuntor por corretora e conector.';
create index integracao_saude_corretora_idx on public.integracao_saude (corretora_id);
create unique index integracao_saude_unica on public.integracao_saude (corretora_id, conector);

-- -----------------------------------------------------------------------------
-- Quarentena — canal desconhecido nunca vira oportunidade por adivinhação (§6.8)
-- -----------------------------------------------------------------------------
create table public.lead_quarentena (
  id uuid primary key default gen_random_uuid(),
  -- Sem tenant de propósito: o lead está aqui justamente por não ter dono conhecido.
  chave_identificacao text,
  origem text,
  corpo_cru jsonb not null,
  motivo text not null,
  resolvido_em timestamptz,
  criado_em timestamptz not null default now()
);
comment on table public.lead_quarentena is 'categoria=plataforma; Lead cujo canal não foi reconhecido.';
create index lead_quarentena_pendentes_idx on public.lead_quarentena (criado_em)
  where resolvido_em is null;

-- -----------------------------------------------------------------------------
-- Auditoria — append-only, garantido por policy (§15.1)
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid references public.corretora (id) on delete set null,
  usuario_id uuid references public.usuario (id) on delete set null,
  acao text not null,
  recurso text,
  recurso_id text,
  detalhe jsonb not null default '{}'::jsonb,
  ocorrido_em timestamptz not null default now()
);
comment on table public.auditoria is 'categoria=plataforma; Trilha append-only de ação sensível.';
create index auditoria_corretora_idx on public.auditoria (corretora_id, ocorrido_em desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id, ocorrido_em desc);
