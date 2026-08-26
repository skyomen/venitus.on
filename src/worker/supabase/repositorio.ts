import type { SupabaseClient } from '@supabase/supabase-js';
import type { Agendamento, Encerramento } from '@/nucleo/followup/regua';
import { redigirTexto } from '@/seguranca/redator';
import type { ContextoDoDisparo, ItemAgendado, ItemDeOutbox, RepositorioDoWorker } from '../portas';
import {
  classificarAgendamentos,
  classificarOutbox,
  montarContextoDoDisparo,
  reguaDoAgendamento,
} from './mapeamento';
import type { LinhaDeAgendamento, LinhaDeOutbox, Recusa } from './mapeamento';

/**
 * O repositório do worker, contra o Supabase.
 *
 * É adaptador: não decide nada. Quem decide o destino de cada item é
 * `decisoes.ts`, e quem interpreta as linhas é `mapeamento.ts` — ambos puros e
 * cobertos por teste de unidade. O que sobra aqui é chamada de banco, e quem
 * verifica isso é o teste de integração contra o Postgres real.
 *
 * O cliente é `service_role`, que **ignora a RLS**: cada função chamada aqui
 * resolve o tenant sozinha, a partir da própria oportunidade.
 */

interface ErroDoBanco {
  readonly message: string;
}

/**
 * Falha de banco vira exceção, e é o laço quem isola.
 *
 * A mensagem passa pelo redator antes de subir: erro de constraint carrega o
 * valor recusado, e o valor recusado costuma ser um CPF ou um telefone.
 */
function exigir(erro: ErroDoBanco | null, oQue: string): void {
  if (erro !== null) {
    throw new Error(`${oQue}: ${redigirTexto(erro.message)}`);
  }
}

function emSegundos(segundos: number): string {
  return new Date(Date.now() + segundos * 1000).toISOString();
}

type Alterador = (id: string, campos: Record<string, unknown>) => Promise<void>;

function alteradorDe(supabase: SupabaseClient, tabela: string, oQue: string): Alterador {
  return async (id, campos) => {
    const { error } = await supabase.from(tabela).update(campos).eq('id', id);
    exigir(error, oQue);
  };
}

/** O que o worker faz com um agendamento, do disparo ao desfecho. */
function parteDosAgendamentos(supabase: SupabaseClient) {
  const alterar = alteradorDe(supabase, 'agendamento', 'não foi possível atualizar o agendamento');

  return {
    async carregarContexto(item: ItemAgendado): Promise<ContextoDoDisparo | null> {
      const { data, error } = await supabase.rpc('contexto_do_disparo', {
        p_oportunidade: item.oportunidadeId,
        p_template: item.template ?? null,
      });
      exigir(error, 'não foi possível carregar o contexto do disparo');

      return montarContextoDoDisparo(data, item);
    },

    async concluirAgendamento(id: string): Promise<void> {
      await alterar(id, { status: 'EXECUTADO', executado_em: new Date().toISOString() });
    },

    async cancelarAgendamento(id: string, motivo: string): Promise<void> {
      await alterar(id, { status: 'CANCELADO', motivo });
    },

    async falharAgendamento(id: string, motivo: string): Promise<void> {
      await alterar(id, { status: 'FALHOU', motivo });
    },

    async reagendar(id: string, segundos: number): Promise<void> {
      // Segue PENDENTE: reagendar é adiar a mesma tentativa, não abrir outra.
      await alterar(id, { executar_em: emSegundos(segundos) });
    },

    async criarProximoPasso(oportunidadeId: string, proximo: Agendamento): Promise<void> {
      const { error } = await supabase.rpc('agendar_passo', {
        p_oportunidade: oportunidadeId,
        p_tipo: proximo.tipo,
        p_executar_em: proximo.executarEm.toISOString(),
        p_chave: proximo.chaveUnicidade,
        // A régua vai gravada para que o próximo tique não precise deduzi-la.
        p_payload: { regua: reguaDoAgendamento(null, proximo.tipo) },
      });
      exigir(error, 'não foi possível agendar o próximo passo');
    },

    async encerrarOportunidade(oportunidadeId: string, encerramento: Encerramento): Promise<void> {
      // A etapa só muda por aqui: o gatilho recusa `update` direto em `etapa`.
      const { error } = await supabase.rpc('mover_oportunidade', {
        p_oportunidade: oportunidadeId,
        p_para: encerramento.tipo === 'MARCAR_PERDIDA' ? 'PERDIDA' : 'ENCERRADA_SEM_CONTATO',
        p_ator: 'AUTOMACAO',
        p_motivo: encerramento.motivo,
      });
      exigir(error, 'não foi possível encerrar a oportunidade');
    },
  };
}

/** O que o worker faz com um item do outbox. */
function parteDoOutbox(supabase: SupabaseClient) {
  const alterar = alteradorDe(supabase, 'integracao_outbox', 'não foi possível atualizar o outbox');

  return {
    async concluirOutbox(id: string): Promise<void> {
      await alterar(id, { status: 'ENTREGUE', entregue_em: new Date().toISOString() });
    },

    async aguardarConector(id: string): Promise<void> {
      // Fica parado de propósito: sem conector real, reexecutar só encheria o
      // log. Volta a andar quando a integração entrar (§10.5).
      await alterar(id, { status: 'AGUARDANDO_CONECTOR' });
    },

    async falharOutbox(id: string, motivo: string, segundos: number | null): Promise<void> {
      // Sem prazo de retorno, desistiu: `FALHOU` continua elegível à reserva e o
      // item voltaria no tique seguinte, para sempre.
      await alterar(
        id,
        segundos === null
          ? { status: 'DESISTIU', ultimo_erro: redigirTexto(motivo) }
          : {
              status: 'FALHOU',
              ultimo_erro: redigirTexto(motivo),
              proxima_tentativa_em: emSegundos(segundos),
            },
      );
    },
  };
}

export function criarRepositorio(supabase: SupabaseClient): RepositorioDoWorker {
  const repositorio: RepositorioDoWorker = {
    ...parteDosAgendamentos(supabase),
    ...parteDoOutbox(supabase),

    async reservarAgendamentos(limite: number): Promise<readonly ItemAgendado[]> {
      const { data, error } = await supabase.rpc('reservar_agendamentos', { p_limite: limite });
      exigir(error, 'não foi possível reservar agendamentos');

      const { itens, recusadas } = classificarAgendamentos(
        (data ?? []) as readonly LinhaDeAgendamento[],
      );
      await Promise.all(
        recusadas.map((r: Recusa) => repositorio.falharAgendamento(r.id, r.motivo)),
      );

      return itens;
    },

    async reservarOutbox(limite: number): Promise<readonly ItemDeOutbox[]> {
      const { data, error } = await supabase.rpc('reservar_outbox', { p_limite: limite });
      exigir(error, 'não foi possível reservar o outbox');

      const { itens, recusadas, semConector } = classificarOutbox(
        (data ?? []) as readonly LinhaDeOutbox[],
      );
      await Promise.all([
        ...recusadas.map((r: Recusa) => repositorio.falharOutbox(r.id, r.motivo, null)),
        ...semConector.map((id: string) => repositorio.aguardarConector(id)),
      ]);

      return itens;
    },
  };

  return repositorio;
}
