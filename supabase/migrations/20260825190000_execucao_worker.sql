-- =============================================================================
-- 008 — Execução das funções de domínio pelo worker
--
-- As migrations anteriores revogaram `execute` de `public` para tirar as funções
-- do alcance de `anon` e `authenticated`. Só que `service_role` herda de
-- `public`, então a revogação o cortou junto — e é justamente ele quem o worker
-- e os webhooks usam.
--
-- A concessão vai explícita, nomeando quem pode. Devolver o privilégio a
-- `public` resolveria o sintoma e reabriria a porta para `authenticated`.
-- =============================================================================

grant execute on function public.receber_lead(text, text, text, text, jsonb) to service_role;
grant execute on function public.localizar_ou_criar_contato(uuid, text, text, text) to service_role;
grant execute on function public.abrir_oportunidade(uuid, uuid, uuid, public.origem_lead)
  to service_role;
grant execute on function public.mover_oportunidade(
  uuid, public.etapa_oportunidade, text, text
) to service_role;
