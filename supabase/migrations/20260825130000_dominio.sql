-- =============================================================================
-- 002 — Núcleo comercial
--
-- Blueprint §7.2 e §7.3. Toda tabela aqui é de domínio: carrega `corretora_id`,
-- tem RLS habilitado e forçado, e índice na coluna de tenant.
--
-- Visibilidade das tabelas filhas: em vez de repetir a regra do consultor em cada
-- policy, elas perguntam se a oportunidade é visível. Como esse `exists` também
-- passa pela RLS de `oportunidade`, a regra vive num lugar só e as filhas a herdam.
-- =============================================================================

create type public.etapa_oportunidade as enum (
  'NOVO',
  'EM_VALIDACAO',
  'AGUARDANDO_DADO',
  'QUALIFICADO',
  'EM_COTACAO',
  'COTADO',
  'NA_FILA',
  'ATRIBUIDO',
  'EM_NEGOCIACAO',
  'PROPOSTA_EM_ELABORACAO',
  'PROPOSTA_TRANSMITIDA',
  'EM_VISTORIA',
  'EM_ANALISE_SEGURADORA',
  'AGUARDANDO_APOLICE',
  'VENDIDA',
  'PERDIDA',
  'ENCERRADA_SEM_CONTATO'
);

create type public.contatabilidade as enum ('CONTATAVEL', 'NAO_CONTATAVEL');
create type public.completude as enum ('COMPLETO', 'PENDENTE');
create type public.intencao as enum ('FRIA', 'MORNA', 'QUENTE');

create type public.preocupacao as enum (
  'ROUBO_FURTO',
  'DANOS_ACIDENTAIS',
  'DANOS_TERCEIROS',
  'TODAS'
);

create type public.origem_lead as enum (
  'META_ADS',
  'GOOGLE',
  'LANDING_PAGE',
  'WHATSAPP',
  'INDICACAO',
  'MANUAL',
  'CARTEIRA_IMPORTADA',
  'RENOVACAO'
);

create type public.canal as enum ('WHATSAPP', 'EMAIL', 'TELEFONE', 'WEB');
create type public.direcao as enum ('ENTRADA', 'SAIDA');

-- Quem conduz a conversa (§11.5). Sem isto, a automação cobra o cliente enquanto
-- o consultor está falando com ele.
create type public.dono_conversa as enum ('AUTOMACAO', 'CONSULTOR', 'AUTOMACAO_ASSISTIDA');

create type public.tipo_pendencia as enum (
  'DOCUMENTO',
  'PAGAMENTO',
  'VISTORIA',
  'RASTREADOR',
  'ANALISE_SEGURADORA',
  'DADO_CADASTRAL'
);

create type public.status_pendencia as enum ('ABERTA', 'RESOLVIDA', 'CANCELADA');
create type public.tipo_documento as enum ('CNH', 'CRLV', 'ESPELHO_PROPOSTA', 'APOLICE', 'OUTRO');
create type public.status_cotacao as enum ('SOLICITADA', 'RETORNADA', 'FALHOU', 'INCOMPLETA');

create type public.status_proposta as enum (
  'EM_ELABORACAO',
  'ESPELHO_ENVIADO',
  'CONFIRMADA',
  'TRANSMITIDA',
  'RECUSADA',
  'APROVADA'
);

create type public.forma_pagamento as enum ('BOLETO', 'CARTAO');

-- Resposta sintética de conector em modo stub não conta como venda real (§10.5).
create type public.origem_resposta as enum ('REAL', 'STUB');

-- -----------------------------------------------------------------------------
-- Contato — identidade única da pessoa dentro da corretora
-- -----------------------------------------------------------------------------
create table public.contato (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  nome text not null,
  cpf text,
  telefone_e164 text,
  email text,
  cep text,
  data_nascimento date,
  sexo text,
  estado_civil text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Sem CPF nem telefone não há como reconhecer a pessoa de novo, e a regra de
  -- "contato não duplica" deixaria de valer na entrada seguinte.
  constraint contato_precisa_de_identificador check (cpf is not null or telefone_e164 is not null)
);
comment on table public.contato is 'categoria=dominio; Pessoa. Não duplica dentro da corretora.';
create index contato_corretora_idx on public.contato (corretora_id);

-- A unicidade é por corretora: a mesma pessoa atendida por duas corretoras são
-- dois contatos, porque os tenants não se enxergam.
create unique index contato_cpf_unico on public.contato (corretora_id, cpf) where cpf is not null;
create unique index contato_telefone_unico on public.contato (corretora_id, telefone_e164)
  where telefone_e164 is not null;

-- -----------------------------------------------------------------------------
-- Oportunidade — uma intenção comercial. Pode se repetir no mesmo contato.
-- -----------------------------------------------------------------------------
create table public.oportunidade (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  contato_id uuid not null references public.contato (id) on delete restrict,
  produto_id uuid references public.produto (id) on delete restrict,
  etapa public.etapa_oportunidade not null default 'NOVO',
  origem public.origem_lead not null,
  consultor_id uuid references public.usuario (id) on delete set null,
  dono_conversa public.dono_conversa not null default 'AUTOMACAO',
  prioridade integer not null default 0,
  entrou_na_fila_em timestamptz,
  atribuido_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento text,

  -- Renovação aponta para a apólice que vence (§8.5). A referência é adicionada
  -- depois que `apolice` existe.
  apolice_origem_id uuid,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- O SLA comercial começa na atribuição (§1.3). Sem consultor não há atribuição,
  -- e sem atribuição não há SLA de pessoa nenhuma.
  constraint oportunidade_atribuicao_coerente check (
    (consultor_id is null and atribuido_em is null)
    or (consultor_id is not null and atribuido_em is not null)
  ),
  constraint oportunidade_encerramento_coerente check (
    etapa not in ('PERDIDA', 'ENCERRADA_SEM_CONTATO') or motivo_encerramento is not null
  )
);
comment on table public.oportunidade is 'categoria=dominio; Intenção comercial. Repete no mesmo contato.';
create index oportunidade_corretora_idx on public.oportunidade (corretora_id);
create index oportunidade_consultor_idx on public.oportunidade (corretora_id, consultor_id);
create index oportunidade_contato_idx on public.oportunidade (contato_id);

-- Índice da fila: prioridade alta primeiro, e entre iguais o mais antigo (§9.4).
create index oportunidade_fila_idx on public.oportunidade (corretora_id, prioridade desc, entrou_na_fila_em)
  where etapa = 'NA_FILA' and consultor_id is null;

-- -----------------------------------------------------------------------------
-- Qualificação — três dimensões independentes (§9.1)
-- -----------------------------------------------------------------------------
create table public.qualificacao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null unique references public.oportunidade (id) on delete cascade,
  contatabilidade public.contatabilidade not null default 'CONTATAVEL',
  completude public.completude not null default 'PENDENTE',
  intencao public.intencao not null default 'FRIA',
  preocupacao_principal public.preocupacao,
  calculada_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.qualificacao is 'categoria=dominio; Contatabilidade, completude e intenção. Independentes.';
create index qualificacao_corretora_idx on public.qualificacao (corretora_id);

-- -----------------------------------------------------------------------------
-- Risco de automóvel — específico do ramo (§7.7)
-- -----------------------------------------------------------------------------
create table public.risco_veiculo (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null unique references public.oportunidade (id) on delete cascade,
  placa text,
  marca text,
  modelo text,
  ano_fabricacao integer,
  ano_modelo integer,
  chassi text,
  tipo_uso text,
  garagem_residencia boolean,
  garagem_trabalho boolean,
  garagem_estudo boolean,
  cep_pernoite text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.risco_veiculo is 'categoria=dominio; Risco de automóvel. Outros ramos ganham tabela própria.';
create index risco_veiculo_corretora_idx on public.risco_veiculo (corretora_id);

-- -----------------------------------------------------------------------------
-- Interação e linha do tempo
-- -----------------------------------------------------------------------------
create table public.interacao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  canal public.canal not null,
  direcao public.direcao not null,
  conteudo text,
  template text,
  id_externo text,
  enviado_em timestamptz,
  recebido_em timestamptz,
  criado_em timestamptz not null default now()
);
comment on table public.interacao is 'categoria=dominio; Cada mensagem trocada com o cliente.';
create index interacao_corretora_idx on public.interacao (corretora_id);
create index interacao_oportunidade_idx on public.interacao (oportunidade_id, criado_em desc);

-- Webhook fora de ordem e reentrega são o normal, não a exceção (§10.4).
create unique index interacao_externo_unico on public.interacao (corretora_id, id_externo)
  where id_externo is not null;

create table public.oportunidade_evento (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  tipo text not null,
  de_etapa public.etapa_oportunidade,
  para_etapa public.etapa_oportunidade,
  ator text not null default 'AUTOMACAO',
  motivo text,
  payload jsonb not null default '{}'::jsonb,
  ocorrido_em timestamptz not null default now()
);
comment on table public.oportunidade_evento is 'categoria=dominio; Linha do tempo. Só cresce; é a base das métricas.';
create index oportunidade_evento_corretora_idx on public.oportunidade_evento (corretora_id);
create index oportunidade_evento_oportunidade_idx
  on public.oportunidade_evento (oportunidade_id, ocorrido_em desc);

-- -----------------------------------------------------------------------------
-- Cotação, proposta e apólice
-- -----------------------------------------------------------------------------
create table public.cotacao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  seguradora_id uuid not null references public.seguradora (id) on delete restrict,
  status public.status_cotacao not null default 'SOLICITADA',
  origem_resposta public.origem_resposta not null default 'REAL',
  requisicao jsonb not null default '{}'::jsonb,
  resposta jsonb,
  dado_faltante text,
  executada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.cotacao is 'categoria=dominio; Uma execução contra a seguradora.';
create index cotacao_corretora_idx on public.cotacao (corretora_id);
create index cotacao_oportunidade_idx on public.cotacao (oportunidade_id);

create table public.cotacao_opcao (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  cotacao_id uuid not null references public.cotacao (id) on delete cascade,
  nome_plano text not null,
  coberturas jsonb not null default '{}'::jsonb,
  premio numeric(14, 2),
  franquia numeric(14, 2),
  parcelamento jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
comment on table public.cotacao_opcao is 'categoria=dominio; Cada plano retornado pela seguradora.';
create index cotacao_opcao_corretora_idx on public.cotacao_opcao (corretora_id);
create index cotacao_opcao_cotacao_idx on public.cotacao_opcao (cotacao_id);

create table public.proposta (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  cotacao_opcao_id uuid references public.cotacao_opcao (id) on delete restrict,
  status public.status_proposta not null default 'EM_ELABORACAO',
  forma_pagamento public.forma_pagamento,
  parcelas integer,
  numero_externo text,
  espelho_confirmado_em timestamptz,
  transmitida_em timestamptz,
  motivo_recusa text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.proposta is 'categoria=dominio; Cotação escolhida, formalizada e transmitida.';
create index proposta_corretora_idx on public.proposta (corretora_id);
create index proposta_oportunidade_idx on public.proposta (oportunidade_id);

create table public.apolice (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  proposta_id uuid not null references public.proposta (id) on delete restrict,
  contato_id uuid not null references public.contato (id) on delete restrict,
  numero text not null,
  vigencia_inicio date not null,
  vigencia_fim date not null,
  valor_liquido numeric(14, 2),
  emitida_em timestamptz not null default now(),
  renovacao_agendada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint apolice_vigencia_coerente check (vigencia_fim > vigencia_inicio)
);
comment on table public.apolice is 'categoria=dominio; Contrato emitido. A vigência dispara a renovação.';
create index apolice_corretora_idx on public.apolice (corretora_id);
create index apolice_contato_idx on public.apolice (contato_id);

-- Apólice a vencer sem oportunidade aberta é alarme, não silêncio (§8.5).
create index apolice_vigencia_idx on public.apolice (corretora_id, vigencia_fim);
create unique index apolice_numero_unico on public.apolice (corretora_id, numero);

alter table public.oportunidade
  add constraint oportunidade_apolice_origem_fk
  foreign key (apolice_origem_id) references public.apolice (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Pendências e documentos
-- -----------------------------------------------------------------------------
create table public.pendencia (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  tipo public.tipo_pendencia not null,
  descricao text not null,
  responsavel uuid references public.usuario (id) on delete set null,
  prazo timestamptz,
  status public.status_pendencia not null default 'ABERTA',
  resolvida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.pendencia is 'categoria=dominio; Item rastreável com responsável, prazo e alerta.';
create index pendencia_corretora_idx on public.pendencia (corretora_id);
create index pendencia_abertas_idx on public.pendencia (corretora_id, prazo)
  where status = 'ABERTA';

create table public.documento (
  id uuid primary key default gen_random_uuid(),
  corretora_id uuid not null references public.corretora (id) on delete restrict,
  oportunidade_id uuid not null references public.oportunidade (id) on delete cascade,
  tipo public.tipo_documento not null,
  -- Caminho no bucket privado. O primeiro segmento é o tenant (§12).
  caminho text not null,
  enviado_por uuid references public.usuario (id) on delete set null,
  enviado_em timestamptz not null default now()
);
comment on table public.documento is 'categoria=dominio; Referência ao arquivo no bucket privado.';
create index documento_corretora_idx on public.documento (corretora_id);
create unique index documento_caminho_unico on public.documento (caminho);
