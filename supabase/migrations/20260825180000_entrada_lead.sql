-- =============================================================================
-- 007 — Entrada de lead
--
-- Blueprint §6.8: é o canal que diz de quem é o lead. O tenant nunca vem de um
-- campo do corpo — se viesse, qualquer um postaria lead na corretora que
-- quisesse.
--
-- Canal desconhecido vai para quarentena e nunca vira oportunidade por
-- adivinhação.
-- =============================================================================

-- Produto padrão do canal: o que aquela entrada vende. Sem isto, o lead chegaria
-- sem saber qual produto está sendo cotado.
alter table public.canal_captacao
  add column produto_id uuid references public.produto (id) on delete restrict;

-- Por qual porta o lead entrou. É o que liga a oportunidade à origem e permite
-- calcular conversão por canal (blueprint §24).
alter table public.oportunidade
  add column canal_captacao_id uuid references public.canal_captacao (id) on delete set null;

create index oportunidade_canal_idx on public.oportunidade (corretora_id, canal_captacao_id);

-- Deduplicação de entrega: o mesmo evento reentregue não abre duas jornadas.
alter table public.lead_quarentena
  add column id_evento text;

create unique index lead_quarentena_evento_unico on public.lead_quarentena (id_evento)
  where id_evento is not null;

-- -----------------------------------------------------------------------------
-- Recebe um lead cru e devolve a oportunidade, ou nada quando não há dono.
-- -----------------------------------------------------------------------------
create or replace function public.receber_lead(
  p_chave_canal text,
  p_nome text,
  p_telefone text default null,
  p_cpf text default null,
  p_corpo jsonb default '{}'::jsonb
) returns public.oportunidade
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canal public.canal_captacao;
  v_contato public.contato;
  v_oportunidade public.oportunidade;
begin
  select * into v_canal
  from public.canal_captacao c
  where c.chave_identificacao = p_chave_canal
    and c.ativo;

  -- Sem canal reconhecido não há dono, e adivinhar seria pior que perder.
  if not found then
    insert into public.lead_quarentena (chave_identificacao, origem, corpo_cru, motivo)
    values (p_chave_canal, p_corpo ->> 'origem', p_corpo, 'CANAL_NAO_RECONHECIDO');
    return null;
  end if;

  -- Identidade em conflito entre dois cadastros também vai para quarentena:
  -- unir contatos é decisão de negócio, não efeito colateral de uma inserção.
  begin
    v_contato := public.localizar_ou_criar_contato(
      v_canal.corretora_id, p_nome, nullif(p_cpf, ''), nullif(p_telefone, '')
    );
  exception
    when unique_violation then
      insert into public.lead_quarentena (chave_identificacao, origem, corpo_cru, motivo)
      values (p_chave_canal, v_canal.origem::text, p_corpo, 'CONFLITO_DE_IDENTIDADE');
      return null;
  end;

  v_oportunidade := public.abrir_oportunidade(
    v_canal.corretora_id, v_contato.id, v_canal.produto_id, v_canal.origem
  );

  update public.oportunidade
     set canal_captacao_id = v_canal.id
   where id = v_oportunidade.id
  returning * into v_oportunidade;

  return v_oportunidade;
end;
$$;

revoke execute on function public.receber_lead(text, text, text, text, jsonb)
  from anon, authenticated, public;
