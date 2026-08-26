-- =============================================================================
-- 010 — O contexto de um disparo de follow-up
--
-- O portão de envio (§11.4) precisa de sete coisas antes de deixar uma mensagem
-- sair: consentimento, dono da conversa, horário da corretora, janela de 24 h,
-- destino, aprovação do template e a pendência real que a mensagem vai cobrar.
--
-- Elas moram em cinco tabelas. Buscá-las em cinco viagens abriria espaço para o
-- worker decidir sobre um retrato inconsistente — o cliente responde entre a
-- primeira consulta e a última, e a régua dispara mesmo assim. Uma consulta só,
-- num instante só.
-- =============================================================================

/**
 * Tudo que o portão de envio precisa saber sobre uma oportunidade, agora.
 *
 * Devolve `null` quando a oportunidade não existe — quem chama cancela o
 * agendamento em vez de insistir, porque insistir não a traria de volta.
 *
 * `dia_semana` segue `extract(dow)`: 0 é domingo.
 */
create or replace function public.contexto_do_disparo(
  p_oportunidade uuid,
  p_template text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidade;
  v_contato public.contato;
  v_fuso text;
  v_local timestamp;
  v_janelas jsonb;
  v_pendencia jsonb;
  v_aprovado timestamptz;
begin
  select * into v_oportunidade from public.oportunidade o where o.id = p_oportunidade;

  if not found then
    return null;
  end if;

  select * into v_contato from public.contato c where c.id = v_oportunidade.contato_id;
  select b.fuso_horario into v_fuso from public.corretora b where b.id = v_oportunidade.corretora_id;

  -- O horário de atendimento é da corretora, no fuso dela. Comparar contra o
  -- relógio do servidor mandaria mensagem de madrugada para metade do país.
  v_local := now() at time zone v_fuso;

  select coalesce(
    jsonb_agg(
      jsonb_build_array(
        extract(hour from h.inicio) * 60 + extract(minute from h.inicio),
        extract(hour from h.fim) * 60 + extract(minute from h.fim)
      ) order by h.inicio
    ),
    '[]'::jsonb
  )
  into v_janelas
  from public.horario_atendimento h
  where h.corretora_id = v_oportunidade.corretora_id
    and h.dia_semana = extract(dow from v_local);

  -- A pendência mais urgente é o assunto da mensagem (§11.2). Sem prazo vai por
  -- último: quem tem data marcada aperta mais que quem não tem.
  select jsonb_build_object('tipo', p.tipo, 'descricao', p.descricao)
  into v_pendencia
  from public.pendencia p
  where p.oportunidade_id = p_oportunidade and p.status = 'ABERTA'
  order by p.prazo asc nulls last, p.criado_em asc
  limit 1;

  if p_template is not null then
    select t.aprovado_em into v_aprovado
    from public.template_mensagem t
    where t.corretora_id = v_oportunidade.corretora_id
      and t.codigo = p_template
      and t.ativo;
  end if;

  return jsonb_build_object(
    'agora', now(),
    'dono_conversa', v_oportunidade.dono_conversa,
    'etapa', v_oportunidade.etapa,
    'ultima_mensagem_cliente_em', v_oportunidade.ultima_mensagem_cliente_em,
    -- Opt-out vence opt-in: quem pediu para não receber, não recebe (§14).
    'consentimento', (v_contato.consentimento_em is not null and v_contato.optout_em is null),
    'janelas_do_dia', v_janelas,
    'minutos_do_dia', extract(hour from v_local) * 60 + extract(minute from v_local),
    'telefone_e164', v_contato.telefone_e164,
    'primeiro_nome', split_part(v_contato.nome, ' ', 1),
    'pendencia', v_pendencia,
    'template_aprovado_em', v_aprovado
  );
end;
$$;

-- `revoke ... from public` corta o `service_role` junto, porque ele herda de
-- `public`. A concessão vem depois, e explícita.
revoke execute on function public.contexto_do_disparo(uuid, text)
  from anon, authenticated, public;
grant execute on function public.contexto_do_disparo(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Por que um agendamento terminou como terminou
-- -----------------------------------------------------------------------------

/**
 * O motivo do desfecho, ao lado do desfecho.
 *
 * `status` sozinho não explica nada: CANCELADO pode ser "o consultor assumiu a
 * conversa" ou "o cliente pediu para não receber mensagens", e quem investiga um
 * follow-up que não saiu precisa saber qual dos dois foi.
 */
alter table public.agendamento add column motivo text;

-- -----------------------------------------------------------------------------
-- Desistir é um estado, não uma data distante
-- -----------------------------------------------------------------------------

/**
 * O worker reserva o outbox por `status in ('PENDENTE', 'FALHOU')`, então
 * `FALHOU` significa "vai tentar de novo". Um item que não vale mais tentar
 * — payload recusado, operação desconhecida, limite de tentativas estourado —
 * precisava de outro nome; empurrar `proxima_tentativa_em` para daqui a cem anos
 * funcionaria e mentiria para quem lesse a tabela.
 */
alter type public.status_outbox add value if not exists 'DESISTIU';

-- -----------------------------------------------------------------------------
-- O worker escreve nestas duas tabelas
-- -----------------------------------------------------------------------------

/**
 * `service_role` não recebe DML automaticamente.
 *
 * A configuração local mantém `auto_expose_new_tables` desligado, que é o padrão
 * novo da nuvem: tabela criada depois não fica alcançável pelos papéis da Data
 * API sem GRANT explícito — e `service_role` é um deles. Sem estas duas linhas o
 * worker reserva o lote pelas funções `security definer` e depois falha com
 * `permission denied` na hora de gravar o desfecho.
 *
 * Só `select` e `update`: quem insere agendamento é `agendar_passo` e quem
 * insere no outbox é `mover_oportunidade`, ambas `security definer`. O worker
 * nunca cria nem apaga linha nenhuma aqui.
 */
grant select, update on public.agendamento to service_role;
grant select, update on public.integracao_outbox to service_role;
