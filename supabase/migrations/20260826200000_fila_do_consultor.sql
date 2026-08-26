-- =============================================================================
-- 011 — O consultor puxa a própria fila
--
-- `distribuir_proxima(uuid)` recebe o consultor por parâmetro, e por isso só é
-- alcançável por `service_role`: liberar para `authenticated` deixaria qualquer
-- usuário distribuir oportunidade para outra pessoa — ou para si mesmo na
-- corretora alheia.
--
-- A porta que a tela usa não recebe parâmetro nenhum. A identidade vem de
-- `auth.uid()`, que é o token, que é o que a RLS também enxerga (§6.1).
-- =============================================================================

/**
 * Assume a próxima oportunidade da fila para quem está chamando.
 *
 * Devolve nada quando a fila está vazia, quando o consultor bateu a capacidade
 * ou quando quem chama não é consultor — os três são "não há nada para você
 * agora", e não erro.
 *
 * **A fila entrega; o consultor não escolhe.** Não existe função para assumir
 * uma oportunidade específica, de propósito: escolher a dedo desmontaria a
 * ordem de prioridade que §9.4 existe para garantir, e o lead frio que envelhece
 * nunca mais seria atendido.
 */
create or replace function public.assumir_proxima_da_fila()
returns public.oportunidade
language sql
security definer
set search_path = ''
as $$
  select public.distribuir_proxima(auth.uid());
$$;

revoke execute on function public.assumir_proxima_da_fila() from anon, public;
grant execute on function public.assumir_proxima_da_fila() to authenticated;
