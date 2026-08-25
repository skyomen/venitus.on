-- =============================================================================
-- 009 — Fila comercial, distribuição e réguas
--
-- Blueprint §9.4 e §11. O consultor só é atribuído quando a vez chega na fila
-- humana — é esse o momento em que começa o SLA comercial (§1.3).
-- =============================================================================

-- Consentimento de contato: opt-in registrado com data e origem (§14).
alter table public.contato
  add column consentimento_em timestamptz,
  add column consentimento_origem text,
  add column optout_em timestamptz;

-- Quando o cliente falou pela última vez. É o que abre a janela de 24 h (§11.4).
alter table public.oportunidade
  add column ultima_mensagem_cliente_em timestamptz;

-- -----------------------------------------------------------------------------
-- Distribuição
-- -----------------------------------------------------------------------------

/**
 * Entrega a próxima oportunidade da fila a um consultor.
 *
 * `for update skip locked` é o que impede dois workers de entregarem a mesma
 * oportunidade: quem chegou primeiro trava a linha, e o segundo pula para a
 * seguinte em vez de esperar.
 *
 * Devolve nada quando o consultor está na capacidade ou a fila está vazia.
 */
create or replace function public.distribuir_proxima(p_consultor uuid)
returns public.oportunidade
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuario;
  v_em_atendimento integer;
  v_oportunidade public.oportunidade;
begin
  select * into v_usuario from public.usuario u where u.id = p_consultor and u.status = 'ATIVO';

  if not found or v_usuario.papel <> 'CONSULTOR' or v_usuario.corretora_id is null then
    return null;
  end if;

  select count(*) into v_em_atendimento
  from public.oportunidade o
  where o.consultor_id = p_consultor
    and not public.etapa_e_terminal(o.etapa);

  -- Capacidade zero significa sem limite: é o padrão de quem ainda não
  -- configurou, e recusar tudo nesse caso deixaria a fila parada.
  if v_usuario.capacidade_atendimento > 0
     and v_em_atendimento >= v_usuario.capacidade_atendimento then
    return null;
  end if;

  with proxima as (
    select o.id
    from public.oportunidade o
    where o.corretora_id = v_usuario.corretora_id
      and o.etapa = 'NA_FILA'
      and o.consultor_id is null
    order by o.prioridade desc, o.entrou_na_fila_em asc
    for update skip locked
    limit 1
  )
  update public.oportunidade o
     set consultor_id = p_consultor,
         atribuido_em = now()
    from proxima
   where o.id = proxima.id
  returning o.* into v_oportunidade;

  if not found then
    return null;
  end if;

  -- A transição registra o evento e silencia a automação (§11.5).
  return public.mover_oportunidade(v_oportunidade.id, 'ATRIBUIDO', 'DISTRIBUICAO');
end;
$$;

revoke execute on function public.distribuir_proxima(uuid) from anon, authenticated, public;
grant execute on function public.distribuir_proxima(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Réguas
-- -----------------------------------------------------------------------------

/**
 * Agenda um passo de régua.
 *
 * A chave de unicidade impede que o mesmo passo seja agendado duas vezes para a
 * mesma oportunidade — e o worker reexecuta, então isso acontece.
 */
create or replace function public.agendar_passo(
  p_oportunidade uuid,
  p_tipo text,
  p_executar_em timestamptz,
  p_chave text,
  p_payload jsonb default '{}'::jsonb
) returns public.agendamento
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corretora uuid;
  v_agendamento public.agendamento;
begin
  select o.corretora_id into v_corretora
  from public.oportunidade o where o.id = p_oportunidade;

  if not found then
    raise exception 'oportunidade % não encontrada', p_oportunidade
      using errcode = 'no_data_found';
  end if;

  insert into public.agendamento
    (corretora_id, oportunidade_id, tipo, executar_em, chave_unicidade, payload)
  values (v_corretora, p_oportunidade, p_tipo, p_executar_em, p_chave, p_payload)
  on conflict (chave_unicidade) do nothing
  returning * into v_agendamento;

  if v_agendamento.id is null then
    select * into v_agendamento from public.agendamento a where a.chave_unicidade = p_chave;
  end if;

  return v_agendamento;
end;
$$;

/**
 * O cliente respondeu.
 *
 * Cancela toda a régua pendente na mesma transação que registra a resposta.
 * Sem isso o cliente recebe cobrança depois de já ter respondido — o defeito
 * mais visível que uma régua de follow-up pode ter (§11.3).
 */
create or replace function public.registrar_resposta_do_cliente(
  p_oportunidade uuid,
  p_quando timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancelados integer;
begin
  update public.agendamento
     set status = 'CANCELADO'
   where oportunidade_id = p_oportunidade
     and status = 'PENDENTE';

  get diagnostics v_cancelados = row_count;

  update public.oportunidade
     set ultima_mensagem_cliente_em = p_quando,
         atualizado_em = now()
   where id = p_oportunidade;

  insert into public.oportunidade_evento (corretora_id, oportunidade_id, tipo, ator, payload)
  select o.corretora_id, o.id, 'RESPOSTA_DO_CLIENTE', 'CLIENTE',
         jsonb_build_object('agendamentos_cancelados', v_cancelados)
  from public.oportunidade o where o.id = p_oportunidade;

  return v_cancelados;
end;
$$;

revoke execute on function public.agendar_passo(uuid, text, timestamptz, text, jsonb)
  from anon, authenticated, public;
grant execute on function public.agendar_passo(uuid, text, timestamptz, text, jsonb)
  to service_role;

revoke execute on function public.registrar_resposta_do_cliente(uuid, timestamptz)
  from anon, authenticated, public;
grant execute on function public.registrar_resposta_do_cliente(uuid, timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- Drenagem
-- -----------------------------------------------------------------------------

/**
 * Reserva agendamentos vencidos para execução.
 *
 * `skip locked` de novo: dois workers drenando ao mesmo tempo dividem o lote em
 * vez de brigar por ele.
 */
create or replace function public.reservar_agendamentos(p_limite integer default 50)
returns setof public.agendamento
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with vencidos as (
    select a.id
    from public.agendamento a
    where a.status = 'PENDENTE'
      and a.executar_em <= now()
    order by a.executar_em
    for update skip locked
    limit p_limite
  )
  update public.agendamento a
     set tentativas = a.tentativas + 1
    from vencidos
   where a.id = vencidos.id
  returning a.*;
end;
$$;

revoke execute on function public.reservar_agendamentos(integer) from anon, authenticated, public;
grant execute on function public.reservar_agendamentos(integer) to service_role;

create or replace function public.reservar_outbox(p_limite integer default 50)
returns setof public.integracao_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with pendentes as (
    select o.id
    from public.integracao_outbox o
    where o.status in ('PENDENTE', 'FALHOU')
      and o.proxima_tentativa_em <= now()
    order by o.proxima_tentativa_em
    for update skip locked
    limit p_limite
  )
  update public.integracao_outbox o
     set tentativas = o.tentativas + 1
    from pendentes
   where o.id = pendentes.id
  returning o.*;
end;
$$;

revoke execute on function public.reservar_outbox(integer) from anon, authenticated, public;
grant execute on function public.reservar_outbox(integer) to service_role;
