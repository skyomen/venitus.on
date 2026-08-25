-- =============================================================================
-- 003 — Configuração por corretora
--
-- Blueprint §7.5. É o "CONFIGURAÇÃO POR CORRETORA" da visão, materializado.
-- Tudo aqui é tabela de domínio: o catálogo é comum, mas o que cada corretora
-- habilita e como ela opera pertence ao tenant.
-- =============================================================================

create type public.tipo_canal as enum (
  'WHATSAPP',
  'LANDING_PAGE',
  'FORMULARIO',
  'META_ADS',
  'GOOGLE',
  'API',
  'MANUAL'
);

create type public.modo_distribuicao as enum ('PRIORIDADE', 'RODIZIO');

-- -----------------------------------------------------------------------------
-- Produtos habilitados
-- -----------------------------------------------------------------------------
create table public.corretora_produto (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  produto_id uuid not null references public.produto (id) on delete restrict,
  ativo boolean not null default true,
  parametros jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.corretora_produto is 'categoria=dominio; Quais produtos do catálogo esta corretora vende.';
create index corretora_produto_corretora_idx on public.corretora_produto (corretora_id);
create unique index corretora_produto_unico on public.corretora_produto (corretora_id, produto_id);

-- -----------------------------------------------------------------------------
-- Canais de captação — é o canal que diz de quem é o lead (§6.8)
-- -----------------------------------------------------------------------------
create table public.canal_captacao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  tipo public.tipo_canal not null,

  -- Número de WhatsApp, id de formulário, conta de mídia, chave de API. É por ela
  -- que o lead encontra o dono.
  chave_identificacao text not null,
  origem public.origem_lead not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.canal_captacao is 'categoria=dominio; Resolve o tenant do lead na entrada.';
create index canal_captacao_corretora_idx on public.canal_captacao (corretora_id);

-- Única na plataforma inteira, não por corretora: se duas corretoras pudessem
-- registrar a mesma chave, o lead teria dois donos possíveis e a resolução
-- viraria sorteio.
create unique index canal_captacao_chave_unica on public.canal_captacao (chave_identificacao);

-- -----------------------------------------------------------------------------
-- Operação
-- -----------------------------------------------------------------------------
create table public.horario_atendimento (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  criado_em timestamptz not null default now(),

  constraint horario_coerente check (fim > inicio)
);
comment on table public.horario_atendimento is 'categoria=dominio; Janela de operação e de disparo de mensagem.';
create index horario_atendimento_corretora_idx on public.horario_atendimento (corretora_id);
create unique index horario_atendimento_unico on public.horario_atendimento (corretora_id, dia_semana, inicio);

create table public.regra_distribuicao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  modo public.modo_distribuicao not null default 'PRIORIDADE',

  -- Os pesos de §9.3: intenção, tempo de espera e contexto comercial.
  pesos jsonb not null default '{"intencao": 10, "espera": 1, "contexto": 5}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.regra_distribuicao is 'categoria=dominio; Pesos de prioridade e modo de distribuição.';
create index regra_distribuicao_corretora_idx on public.regra_distribuicao (corretora_id);
create unique index regra_distribuicao_ativa_unica on public.regra_distribuicao (corretora_id)
  where ativo;

create table public.template_mensagem (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  codigo text not null,
  canal public.canal not null,
  corpo text not null,

  -- Fora da janela de 24 h só sai template aprovado (§11.4). Sem data de
  -- aprovação registrada, o disparo falha aqui em vez de falhar com o cliente.
  aprovado_em timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.template_mensagem is 'categoria=dominio; Templates por etapa e por régua.';
create index template_mensagem_corretora_idx on public.template_mensagem (corretora_id);
create unique index template_mensagem_codigo_unico on public.template_mensagem (corretora_id, codigo);

-- -----------------------------------------------------------------------------
-- Custo de mídia — sem ele, CPL e custo por venda não têm numerador (§7.5)
-- -----------------------------------------------------------------------------
create table public.investimento_midia (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete cascade,
  origem public.origem_lead not null,
  periodo date not null,
  valor numeric(14, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.investimento_midia is 'categoria=dominio; Gasto por origem e período. Base de CPL.';
create index investimento_midia_corretora_idx on public.investimento_midia (corretora_id);
create unique index investimento_midia_unico on public.investimento_midia (corretora_id, origem, periodo);
