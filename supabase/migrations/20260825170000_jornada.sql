-- =============================================================================
-- 006 — A máquina de estados da jornada
--
-- Blueprint §8. A jornada é o núcleo do domínio: etapa não pode ser uma coluna
-- que qualquer código escreve. Aqui ela passa a ter transições declaradas, um
-- caminho único para mudá-la, e um gatilho que recusa qualquer outro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- As transições permitidas, como dado e não como código
--
-- Declaradas em tabela porque assim são consultáveis, testáveis e visíveis para
-- quem for desenhar tela sem abrir uma função.
-- -----------------------------------------------------------------------------
create table public.transicao_permitida (
  de public.etapa_oportunidade not null,
  para public.etapa_oportunidade not null,
  primary key (de, para)
);
comment on table public.transicao_permitida is 'categoria=catalogo; Transições válidas da jornada.';

alter table public.transicao_permitida enable row level security;
alter table public.transicao_permitida force row level security;
revoke all on public.transicao_permitida from anon, authenticated;
grant select on public.transicao_permitida to authenticated;
create policy transicao_permitida_leitura on public.transicao_permitida
for select to authenticated using (true);

insert into public.transicao_permitida (de, para) values
  ('NOVO', 'EM_VALIDACAO'),
  ('EM_VALIDACAO', 'AGUARDANDO_DADO'),
  ('EM_VALIDACAO', 'QUALIFICADO'),
  ('AGUARDANDO_DADO', 'EM_VALIDACAO'),
  ('AGUARDANDO_DADO', 'QUALIFICADO'),
  ('QUALIFICADO', 'EM_COTACAO'),
  ('EM_COTACAO', 'COTADO'),
  ('EM_COTACAO', 'AGUARDANDO_DADO'),
  ('COTADO', 'NA_FILA'),
  ('NA_FILA', 'ATRIBUIDO'),
  ('ATRIBUIDO', 'EM_NEGOCIACAO'),
  ('EM_NEGOCIACAO', 'PROPOSTA_EM_ELABORACAO'),
  ('EM_NEGOCIACAO', 'EM_COTACAO'),
  ('PROPOSTA_EM_ELABORACAO', 'PROPOSTA_TRANSMITIDA'),
  ('PROPOSTA_EM_ELABORACAO', 'EM_NEGOCIACAO'),
  ('PROPOSTA_TRANSMITIDA', 'EM_VISTORIA'),
  ('PROPOSTA_TRANSMITIDA', 'EM_ANALISE_SEGURADORA'),
  ('PROPOSTA_TRANSMITIDA', 'PROPOSTA_EM_ELABORACAO'),
  ('EM_VISTORIA', 'EM_ANALISE_SEGURADORA'),
  ('EM_ANALISE_SEGURADORA', 'AGUARDANDO_APOLICE'),
  ('EM_ANALISE_SEGURADORA', 'PROPOSTA_EM_ELABORACAO'),
  ('AGUARDANDO_APOLICE', 'VENDIDA');

-- Perder e encerrar são possíveis de qualquer etapa não terminal: o cliente pode
-- desistir a qualquer momento, e fingir o contrário engessaria a operação.
insert into public.transicao_permitida (de, para)
select e.etapa, terminal.etapa
from unnest(enum_range(null::public.etapa_oportunidade)) as e(etapa)
cross join (values
  ('PERDIDA'::public.etapa_oportunidade),
  ('ENCERRADA_SEM_CONTATO'::public.etapa_oportunidade)
) as terminal(etapa)
where e.etapa not in ('VENDIDA', 'PERDIDA', 'ENCERRADA_SEM_CONTATO');

create or replace function public.etapa_e_terminal(p_etapa public.etapa_oportunidade)
returns boolean language sql immutable set search_path = '' as $$
  select p_etapa in ('VENDIDA', 'PERDIDA', 'ENCERRADA_SEM_CONTATO');
$$;

-- -----------------------------------------------------------------------------
-- O caminho único
--
-- O gatilho recusa mudança de `etapa` que não venha da função de transição. A
-- marca é local à transação, então ela não escapa para outra sessão nem
-- sobrevive a um erro no meio do caminho.
-- -----------------------------------------------------------------------------
create or replace function public.recusar_mudanca_de_etapa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.etapa is distinct from old.etapa
     and coalesce(current_setting('app.transicao_em_curso', true), '') <> 'sim' then
    raise exception
      'etapa só muda por mover_oportunidade(); tentativa de % para %', old.etapa, new.etapa
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger oportunidade_etapa_protegida before update on public.oportunidade
for each row execute function public.recusar_mudanca_de_etapa();

-- -----------------------------------------------------------------------------
-- Os seis passos de §8.2, numa transação só
-- -----------------------------------------------------------------------------
create or replace function public.mover_oportunidade(
  p_oportunidade uuid,
  p_para public.etapa_oportunidade,
  p_ator text default 'AUTOMACAO',
  p_motivo text default null
) returns public.oportunidade
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidade;
  v_de public.etapa_oportunidade;
begin
  -- Trava a linha: duas transições concorrentes na mesma oportunidade fariam
  -- uma delas gravar um evento com a etapa de origem já vencida.
  select * into v_oportunidade
  from public.oportunidade
  where id = p_oportunidade
  for update;

  if not found then
    raise exception 'oportunidade % não encontrada', p_oportunidade
      using errcode = 'no_data_found';
  end if;

  v_de := v_oportunidade.etapa;

  -- 1. A transição é permitida?
  if not exists (
    select 1 from public.transicao_permitida t where t.de = v_de and t.para = p_para
  ) then
    raise exception 'transição inválida: % para %', v_de, p_para
      using errcode = 'check_violation';
  end if;

  -- 2. Pré-condições da etapa de destino.
  if p_para = 'ATRIBUIDO' and v_oportunidade.consultor_id is null then
    raise exception 'ATRIBUIDO exige consultor: o SLA comercial começa aqui'
      using errcode = 'check_violation';
  end if;

  if p_para = 'COTADO' and not exists (
    select 1 from public.cotacao c
    where c.oportunidade_id = p_oportunidade and c.status = 'RETORNADA'
  ) then
    raise exception 'COTADO exige cotação retornada' using errcode = 'check_violation';
  end if;

  if public.etapa_e_terminal(p_para) and coalesce(p_motivo, '') = '' then
    raise exception 'encerrar exige motivo' using errcode = 'check_violation';
  end if;

  -- 4. Cancela o que a etapa anterior havia agendado. Antes da escrita, para que
  --    uma falha aqui não deixe a etapa nova com régua velha pendurada.
  update public.agendamento
     set status = 'CANCELADO'
   where oportunidade_id = p_oportunidade
     and status = 'PENDENTE';

  -- A escrita da etapa. A marca autoriza o gatilho, e é local à transação.
  perform set_config('app.transicao_em_curso', 'sim', true);

  update public.oportunidade
     set etapa = p_para,
         atualizado_em = now(),
         entrou_na_fila_em = case when p_para = 'NA_FILA' then now() else entrou_na_fila_em end,
         encerrada_em = case when public.etapa_e_terminal(p_para) then now() else null end,
         motivo_encerramento = case
           when public.etapa_e_terminal(p_para) then p_motivo
           else motivo_encerramento
         end,
         -- A atribuição silencia a automação (§11.5, D19).
         dono_conversa = case when p_para = 'ATRIBUIDO' then 'CONSULTOR' else dono_conversa end
   where id = p_oportunidade
  returning * into v_oportunidade;

  perform set_config('app.transicao_em_curso', '', true);

  -- 3. A linha do tempo. É dela que saem as métricas do funil (§24).
  insert into public.oportunidade_evento (
    corretora_id, oportunidade_id, tipo, de_etapa, para_etapa, ator, motivo
  )
  values (
    v_oportunidade.corretora_id, p_oportunidade, 'TRANSICAO', v_de, p_para, p_ator, p_motivo
  );

  -- 5 e 6. O espelhamento para o CRM sai por outbox, na mesma transação: é isso
  --        que impede o banco e o sistema externo de divergirem numa falha de rede.
  --        As réguas que cada etapa cria são responsabilidade do motor de
  --        follow-up, que consome estes eventos.
  insert into public.integracao_outbox (
    corretora_id, oportunidade_id, destino, operacao, payload, chave_idempotencia
  )
  values (
    v_oportunidade.corretora_id,
    p_oportunidade,
    'CRM',
    'MOVER_ETAPA',
    jsonb_build_object('de', v_de, 'para', p_para, 'motivo', p_motivo),
    format('crm:etapa:%s:%s:%s', p_oportunidade, p_para, extract(epoch from clock_timestamp()))
  );

  return v_oportunidade;
end;
$$;

revoke execute on function public.mover_oportunidade(uuid, public.etapa_oportunidade, text, text)
  from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- Contato não duplica; oportunidade pode repetir (§8.4)
-- -----------------------------------------------------------------------------
create or replace function public.localizar_ou_criar_contato(
  p_corretora uuid,
  p_nome text,
  p_cpf text default null,
  p_telefone text default null
) returns public.contato
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contato public.contato;
  v_cpf_a_completar text;
  v_telefone_a_completar text;
begin
  if coalesce(p_cpf, '') = '' and coalesce(p_telefone, '') = '' then
    raise exception 'contato exige CPF ou telefone para poder ser reconhecido depois'
      using errcode = 'check_violation';
  end if;

  -- Procura pelos dois identificadores, preferindo o CPF: ele identifica melhor
  -- que o telefone, que troca de dono. Procurar só pelo CPF quando ele vem
  -- deixaria de reconhecer quem foi cadastrado antes só com o telefone.
  select * into v_contato
  from public.contato c
  where c.corretora_id = p_corretora
    and (
      (p_cpf is not null and c.cpf = p_cpf)
      or (p_telefone is not null and c.telefone_e164 = p_telefone)
    )
  order by (p_cpf is not null and c.cpf = p_cpf) desc
  limit 1;

  if not found then
    insert into public.contato (corretora_id, nome, cpf, telefone_e164)
    values (p_corretora, p_nome, nullif(p_cpf, ''), nullif(p_telefone, ''))
    returning * into v_contato;

    return v_contato;
  end if;

  -- Completa o que faltava sem sobrescrever o que já existe: um toque novo
  -- costuma trazer o dado que faltava, não uma correção do que já havia.
  v_cpf_a_completar := case when v_contato.cpf is null then p_cpf end;
  v_telefone_a_completar := case when v_contato.telefone_e164 is null then p_telefone end;

  -- Se o dado que completaria já pertence a outro contato, então dois cadastros
  -- descrevem a mesma pessoa. Unir os dois é decisão de negócio, não efeito
  -- colateral de uma inserção: o chamador encaminha para quarentena.
  if v_cpf_a_completar is not null and exists (
    select 1 from public.contato x
    where x.corretora_id = p_corretora and x.cpf = v_cpf_a_completar and x.id <> v_contato.id
  ) then
    raise exception 'conflito de identidade: o CPF já pertence a outro contato desta corretora'
      using errcode = 'unique_violation';
  end if;

  if v_telefone_a_completar is not null and exists (
    select 1 from public.contato x
    where x.corretora_id = p_corretora
      and x.telefone_e164 = v_telefone_a_completar
      and x.id <> v_contato.id
  ) then
    raise exception 'conflito de identidade: o telefone já pertence a outro contato desta corretora'
      using errcode = 'unique_violation';
  end if;

  update public.contato
     set cpf = coalesce(cpf, v_cpf_a_completar),
         telefone_e164 = coalesce(telefone_e164, v_telefone_a_completar),
         atualizado_em = now()
   where id = v_contato.id
  returning * into v_contato;

  return v_contato;
end;
$$;

revoke execute on function public.localizar_ou_criar_contato(uuid, text, text, text)
  from anon, authenticated, public;

/**
 * Abre a oportunidade certa para um contato.
 *
 * Substitui a regra atual da operação, que marca "Duplicidade" e perde a
 * oportunidade quando houve contato nos últimos 15 dias. Aqui o histórico é
 * preservado: mesma intenção ativa atualiza; intenção nova vira negócio novo.
 */
create or replace function public.abrir_oportunidade(
  p_corretora uuid,
  p_contato uuid,
  p_produto uuid,
  p_origem public.origem_lead
) returns public.oportunidade
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidade;
begin
  select * into v_oportunidade
  from public.oportunidade o
  where o.corretora_id = p_corretora
    and o.contato_id = p_contato
    and o.produto_id is not distinct from p_produto
    and not public.etapa_e_terminal(o.etapa)
  order by o.criado_em desc
  limit 1;

  if found then
    insert into public.oportunidade_evento (
      corretora_id, oportunidade_id, tipo, ator, payload
    )
    values (
      p_corretora, v_oportunidade.id, 'TOQUE_REPETIDO', 'AUTOMACAO',
      jsonb_build_object('origem', p_origem)
    );

    return v_oportunidade;
  end if;

  insert into public.oportunidade (corretora_id, contato_id, produto_id, origem)
  values (p_corretora, p_contato, p_produto, p_origem)
  returning * into v_oportunidade;

  insert into public.qualificacao (corretora_id, oportunidade_id)
  values (p_corretora, v_oportunidade.id);

  insert into public.oportunidade_evento (
    corretora_id, oportunidade_id, tipo, para_etapa, ator, payload
  )
  values (
    p_corretora, v_oportunidade.id, 'ABERTURA', 'NOVO', 'AUTOMACAO',
    jsonb_build_object('origem', p_origem)
  );

  return v_oportunidade;
end;
$$;

revoke execute on function public.abrir_oportunidade(uuid, uuid, uuid, public.origem_lead)
  from anon, authenticated, public;
