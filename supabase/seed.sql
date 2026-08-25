-- =============================================================================
-- Seed sintético — SOMENTE local e homologação.
--
-- Blueprint §19: seed nunca roda em produção.
-- AGENTS.md invariante 10: todo dado aqui é fictício.
--
-- Duas corretoras não são enfeite: o teste de isolamento precisa de um segundo
-- tenant para provar que o vazamento não acontece.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
insert into public.plano (id, codigo, nome, limites, recursos, preco)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'PILOTO',
    'Piloto',
    '{"usuarios": 10, "leads_mes": 1000}',
    '{"cotacao": true, "renovacao": true}',
    0
  );

insert into public.seguradora (id, codigo, nome, conector)
values ('00000000-0000-4000-8000-000000000101', 'SEG_A', 'Seguradora Piloto', 'stub');

insert into public.produto (id, codigo, nome, ramo, seguradora_id)
values (
  '00000000-0000-4000-8000-000000000201',
  'AUTO',
  'Seguro Auto',
  'AUTOMOVEL',
  '00000000-0000-4000-8000-000000000101'
);

-- ---------------------------------------------------------------------------
-- Corretoras
-- ---------------------------------------------------------------------------
insert into public.corretora (id, nome, documento, plano_id, cor_primaria)
values
  (
    '00000000-0000-4000-8000-00000000000a',
    'Corretora Alfa',
    '11222333000144',
    '00000000-0000-4000-8000-000000000001',
    '#0b5fff'
  ),
  (
    '00000000-0000-4000-8000-00000000000b',
    'Corretora Beta',
    '44555666000177',
    '00000000-0000-4000-8000-000000000001',
    '#7a3cff'
  );

-- ---------------------------------------------------------------------------
-- Usuários de acesso
--
-- Senha de todos: Venitus@Local123
-- Criados direto em auth.users porque o seed roda antes de a aplicação existir.
-- A identidade em auth.identities é o que habilita o login por senha no GoTrue.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_senha text := extensions.crypt('Venitus@Local123', extensions.gen_salt('bf'));
begin
  for r in
    select *
    from (
      values
        ('00000000-0000-4000-8000-0000000000f1'::uuid, 'admin@venitus.local',     'Ana Administradora', 'PLATFORM_ADMIN', null::uuid,                                       0),
        ('00000000-0000-4000-8000-0000000000f2'::uuid, 'gestor@alfa.local',       'Gustavo Alfa',       'GESTOR',         '00000000-0000-4000-8000-00000000000a'::uuid,     0),
        ('00000000-0000-4000-8000-0000000000f3'::uuid, 'consultor@alfa.local',    'Carla Alfa',         'CONSULTOR',      '00000000-0000-4000-8000-00000000000a'::uuid,    20),
        ('00000000-0000-4000-8000-0000000000f4'::uuid, 'gestor@beta.local',       'Beatriz Beta',       'GESTOR',         '00000000-0000-4000-8000-00000000000b'::uuid,     0),
        ('00000000-0000-4000-8000-0000000000f5'::uuid, 'consultor@beta.local',    'Bruno Beta',         'CONSULTOR',      '00000000-0000-4000-8000-00000000000b'::uuid,    15)
    ) as t(id, email, nome, papel, corretora_id, capacidade)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, v_senha, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', r.nome),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    values (
      r.id::text, r.id,
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into public.usuario (id, corretora_id, papel, nome, email, capacidade_atendimento)
    values (r.id, r.corretora_id, r.papel::public.papel_usuario, r.nome, r.email, r.capacidade);
  end loop;
end;
$$;
