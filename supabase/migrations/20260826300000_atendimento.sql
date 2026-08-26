-- =============================================================================
-- 012 — O atendimento: o que o consultor muda enquanto conversa
--
-- Nenhuma tabela de domínio aceita `update` de `authenticated` (§6.4): o
-- privilégio foi revogado e as policies só permitem leitura. Toda escrita passa
-- por função `security definer` que resolve a identidade por `auth.uid()`.
--
-- É mais verboso que liberar `update` com policy, e é de propósito: a policy
-- diria *quais linhas* podem mudar, mas não *como*. Aqui a função também
-- registra o evento na linha do tempo, na mesma transação — e a linha do tempo
-- é a base das métricas (§15.1).
-- =============================================================================

-- O plano que o cliente disse preferir, ligado à opção que a seguradora
-- retornou. §9.5 pede essa linha no cartão, e até agora nada a registrava.
alter table public.oportunidade
  add column opcao_interesse_id uuid references public.cotacao_opcao (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Quem pode mexer
-- -----------------------------------------------------------------------------

/**
 * A oportunidade é de quem está pedindo?
 *
 * Consultor mexe no que é dele; gestor mexe no que é da corretora dele. O
 * `PLATFORM_ADMIN` não aparece — ele opera sobre agregados sem PII, e ver dado
 * de cliente exige acesso assistido autorizado pelo gestor (D10).
 *
 * `security definer` porque a função precisa enxergar a linha antes de decidir
 * se quem chama pode. Ela não devolve dado nenhum: só sim ou não.
 */
create or replace function public.oportunidade_sob_minha_responsabilidade(p_oportunidade uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.oportunidade o
    join public.usuario u on u.id = auth.uid()
    where o.id = p_oportunidade
      and u.status = 'ATIVO'
      and o.corretora_id = u.corretora_id
      and (u.papel = 'GESTOR' or o.consultor_id = u.id)
  );
$$;

revoke execute on function public.oportunidade_sob_minha_responsabilidade(uuid)
  from anon, public;
grant execute on function public.oportunidade_sob_minha_responsabilidade(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Resolver uma pendência
-- -----------------------------------------------------------------------------

/**
 * Marca a pendência como resolvida e registra quem resolveu.
 *
 * Pendência já resolvida devolve a própria linha sem gravar de novo: o
 * consultor toca duas vezes no botão do celular com mais frequência do que se
 * imagina, e o segundo toque não pode gerar um segundo evento.
 */
create or replace function public.resolver_pendencia(p_pendencia uuid)
returns public.pendencia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pendencia public.pendencia;
begin
  select * into v_pendencia from public.pendencia p where p.id = p_pendencia for update;

  if not found then
    raise exception 'pendência % não encontrada', p_pendencia using errcode = 'no_data_found';
  end if;

  if not public.oportunidade_sob_minha_responsabilidade(v_pendencia.oportunidade_id) then
    raise exception 'sem acesso a esta pendência' using errcode = 'insufficient_privilege';
  end if;

  if v_pendencia.status <> 'ABERTA' then
    return v_pendencia;
  end if;

  update public.pendencia
     set status = 'RESOLVIDA', resolvida_em = now(), atualizado_em = now()
   where id = p_pendencia
  returning * into v_pendencia;

  insert into public.oportunidade_evento (corretora_id, oportunidade_id, tipo, ator, payload)
  values (
    v_pendencia.corretora_id,
    v_pendencia.oportunidade_id,
    'PENDENCIA_RESOLVIDA',
    'CONSULTOR',
    jsonb_build_object('pendencia', p_pendencia, 'tipo', v_pendencia.tipo)
  );

  return v_pendencia;
end;
$$;

revoke execute on function public.resolver_pendencia(uuid) from anon, public;
grant execute on function public.resolver_pendencia(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Qual plano o cliente quer
-- -----------------------------------------------------------------------------

/**
 * Registra a opção de interesse do cliente.
 *
 * A opção precisa pertencer a uma cotação **desta** oportunidade. Sem essa
 * checagem, um id de outra corretora colado na requisição gravaria um plano que
 * o cliente nunca viu — e a RLS não pegaria, porque quem grava é a função.
 *
 * `null` limpa a escolha: cliente muda de ideia, e desfazer precisa ser tão
 * fácil quanto escolher.
 */
create or replace function public.marcar_plano_de_interesse(
  p_oportunidade uuid,
  p_opcao uuid
) returns public.oportunidade
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidade;
begin
  if not public.oportunidade_sob_minha_responsabilidade(p_oportunidade) then
    raise exception 'sem acesso a esta oportunidade' using errcode = 'insufficient_privilege';
  end if;

  if p_opcao is not null and not exists (
    select 1
    from public.cotacao_opcao co
    join public.cotacao c on c.id = co.cotacao_id
    where co.id = p_opcao and c.oportunidade_id = p_oportunidade
  ) then
    raise exception 'a opção % não é desta oportunidade', p_opcao
      using errcode = 'check_violation';
  end if;

  update public.oportunidade
     set opcao_interesse_id = p_opcao, atualizado_em = now()
   where id = p_oportunidade
  returning * into v_oportunidade;

  insert into public.oportunidade_evento (corretora_id, oportunidade_id, tipo, ator, payload)
  values (
    v_oportunidade.corretora_id,
    p_oportunidade,
    'PLANO_DE_INTERESSE',
    'CONSULTOR',
    jsonb_build_object('opcao', p_opcao)
  );

  return v_oportunidade;
end;
$$;

revoke execute on function public.marcar_plano_de_interesse(uuid, uuid) from anon, public;
grant execute on function public.marcar_plano_de_interesse(uuid, uuid) to authenticated;
