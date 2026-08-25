-- =============================================================================
-- 005 — RLS do domínio e da plataforma
--
-- Blueprint §6.2 e §6.4.
--
-- Escrita: neste momento `authenticated` só lê. A jornada é escrita pela função
-- de transição (006) e pelo worker, que opera com `service_role`. Conceder
-- escrita antes de existir quem escreva seria abrir porta sem porteiro — as
-- policies de escrita entram junto com as telas que precisam delas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Habilita e força RLS em tudo que foi criado nas migrations 002 a 004
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'contato', 'oportunidade', 'qualificacao', 'risco_veiculo', 'interacao',
    'oportunidade_evento', 'cotacao', 'cotacao_opcao', 'proposta', 'apolice',
    'pendencia', 'documento',
    'corretora_produto', 'canal_captacao', 'horario_atendimento',
    'regra_distribuicao', 'template_mensagem', 'investimento_midia',
    'agendamento', 'integracao_credencial', 'integracao_outbox',
    'integracao_evento', 'integracao_saude', 'lead_quarentena', 'auditoria'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Visibilidade da oportunidade
--
-- O gestor enxerga a corretora inteira; o consultor, o que é dele ou o que ainda
-- está livre na fila. Nenhuma menção a PLATFORM_ADMIN (D10, §6.7).
-- -----------------------------------------------------------------------------
create policy oportunidade_leitura on public.oportunidade for select to authenticated
using (
  corretora_id = (select public.corretora_atual())
  and (
    (select public.papel_atual()) = 'GESTOR'
    or consultor_id = (select auth.uid())
    or consultor_id is null
  )
);

-- -----------------------------------------------------------------------------
-- Tabelas ligadas à oportunidade
--
-- Em vez de repetir a regra do consultor, elas perguntam se a oportunidade é
-- visível. O `exists` também passa pela RLS acima, então a regra vive num lugar
-- só — e mudar a visibilidade da oportunidade muda a das filhas junto.
-- -----------------------------------------------------------------------------
create policy qualificacao_leitura on public.qualificacao for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = qualificacao.oportunidade_id));

create policy risco_veiculo_leitura on public.risco_veiculo for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = risco_veiculo.oportunidade_id));

create policy interacao_leitura on public.interacao for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = interacao.oportunidade_id));

create policy oportunidade_evento_leitura on public.oportunidade_evento for select to authenticated
using (
  exists (select 1 from public.oportunidade o where o.id = oportunidade_evento.oportunidade_id)
);

create policy cotacao_leitura on public.cotacao for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = cotacao.oportunidade_id));

create policy cotacao_opcao_leitura on public.cotacao_opcao for select to authenticated
using (exists (select 1 from public.cotacao c where c.id = cotacao_opcao.cotacao_id));

create policy proposta_leitura on public.proposta for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = proposta.oportunidade_id));

create policy pendencia_leitura on public.pendencia for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = pendencia.oportunidade_id));

create policy documento_leitura on public.documento for select to authenticated
using (exists (select 1 from public.oportunidade o where o.id = documento.oportunidade_id));

-- -----------------------------------------------------------------------------
-- Tabelas do tenant sem vínculo com oportunidade
-- -----------------------------------------------------------------------------
create policy contato_leitura on public.contato for select to authenticated
using (corretora_id = (select public.corretora_atual()));

-- A apólice é da carteira da corretora, não de um consultor: quem atende hoje
-- precisa ver o histórico de quem atendeu antes.
create policy apolice_leitura on public.apolice for select to authenticated
using (corretora_id = (select public.corretora_atual()));

create policy corretora_produto_leitura on public.corretora_produto for select to authenticated
using (corretora_id = (select public.corretora_atual()));

create policy canal_captacao_leitura on public.canal_captacao for select to authenticated
using (corretora_id = (select public.corretora_atual()));

create policy horario_atendimento_leitura on public.horario_atendimento for select to authenticated
using (corretora_id = (select public.corretora_atual()));

create policy regra_distribuicao_leitura on public.regra_distribuicao for select to authenticated
using (corretora_id = (select public.corretora_atual()));

create policy template_mensagem_leitura on public.template_mensagem for select to authenticated
using (corretora_id = (select public.corretora_atual()));

-- Custo é informação de gestão. O consultor não precisa dela para vender.
create policy investimento_midia_leitura on public.investimento_midia for select to authenticated
using (
  corretora_id = (select public.corretora_atual())
  and (select public.papel_atual()) = 'GESTOR'
);

-- -----------------------------------------------------------------------------
-- Plataforma restrita — negação explícita
--
-- Estas tabelas pertencem ao worker. A negação é escrita, e não apenas ausência
-- de policy, para que a intenção fique legível e para que um GRANT concedido por
-- engano no futuro ainda esbarre na RLS.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'agendamento', 'integracao_credencial', 'integracao_outbox',
    'integracao_evento', 'integracao_saude', 'lead_quarentena', 'auditoria'
  ]
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (false)',
      t || '_sem_acesso_por_api', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios de leitura
-- -----------------------------------------------------------------------------
grant select on
  public.contato, public.oportunidade, public.qualificacao, public.risco_veiculo,
  public.interacao, public.oportunidade_evento, public.cotacao, public.cotacao_opcao,
  public.proposta, public.apolice, public.pendencia, public.documento,
  public.corretora_produto, public.canal_captacao, public.horario_atendimento,
  public.regra_distribuicao, public.template_mensagem, public.investimento_midia
to authenticated;

-- -----------------------------------------------------------------------------
-- Auditoria é append-only de verdade (§15.1)
--
-- Policy não basta: o `service_role` a ignora. O gatilho vale para todo mundo.
-- -----------------------------------------------------------------------------
create or replace function public.auditoria_e_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'auditoria é append-only: % não é permitido', tg_op;
end;
$$;

create trigger auditoria_sem_alteracao before update or delete on public.auditoria
for each row execute function public.auditoria_e_imutavel();
