import { data, objeto, texto } from '@/dados/leitura';
import { montarCartao } from '@/nucleo/fila/cartao';
import { montarLinhaDaFila } from '@/nucleo/fila/leitura';
import { ehEtapa } from '@/nucleo/jornada/etapa';
import { montarLinhaDoTempo } from './linha-do-tempo';
import type { EventoBruto } from './linha-do-tempo';
import { etapaNaTela, montarOpcoes, montarPendencias, planoEscolhido } from './painel';
import type { OpcaoBruta, PainelDeAtendimento, PendenciaBruta } from './painel';

/**
 * A tradução entre a consulta do atendimento e o painel.
 *
 * A consulta traz cinco relações aninhadas de uma vez, porque a tela precisa
 * das cinco ao mesmo tempo e cinco viagens deixariam o painel montado sobre
 * retratos de instantes diferentes.
 *
 * Nada aqui lança. Oportunidade que não existe — ou que a RLS não deixa ver —
 * devolve `null`, e quem chama transforma isso em 404.
 */

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function numeroOuNada(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor;
  }
  // `numeric` volta como texto do PostgREST, para não perder precisão.
  const convertido = typeof valor === 'string' ? Number(valor) : Number.NaN;
  return Number.isFinite(convertido) ? convertido : null;
}

function pendenciaDe(bruta: unknown): readonly PendenciaBruta[] {
  const p = objeto(bruta);
  const id = p === null ? null : texto(p['id']);

  if (p === null || id === null) {
    return [];
  }

  return [
    {
      id,
      tipo: texto(p['tipo']) ?? 'DOCUMENTO',
      descricao: texto(p['descricao']) ?? 'Pendência sem descrição',
      prazo: data(p['prazo']),
      resolvida: p['status'] !== 'ABERTA',
    },
  ];
}

function pendenciasDe(valor: unknown): readonly PendenciaBruta[] {
  return lista(valor).flatMap(pendenciaDe);
}

/**
 * As opções de todas as cotações, achatadas numa lista só.
 *
 * O cliente não compara "a opção 2 da cotação da seguradora B": ele compara
 * preços. A cotação de origem vira o nome da seguradora ao lado do plano.
 */
function opcaoDe(cru: unknown, seguradora: string | null): readonly OpcaoBruta[] {
  const opcao = objeto(cru);
  const id = opcao === null ? null : texto(opcao['id']);

  if (opcao === null || id === null) {
    return [];
  }

  return [
    {
      id,
      nomePlano: texto(opcao['nome_plano']) ?? 'Plano sem nome',
      premio: numeroOuNada(opcao['premio']),
      franquia: numeroOuNada(opcao['franquia']),
      seguradora,
    },
  ];
}

function opcoesDe(valor: unknown): readonly OpcaoBruta[] {
  return lista(valor).flatMap((bruta) => {
    const cotacao = objeto(bruta);
    const seguradora = texto(objeto(cotacao?.['seguradora'])?.['nome']);

    return lista(cotacao?.['cotacao_opcao']).flatMap((cru) => opcaoDe(cru, seguradora));
  });
}

function eventoDe(bruta: unknown): readonly EventoBruto[] {
  const evento = objeto(bruta);
  const id = evento === null ? null : texto(evento['id']);

  if (evento === null || id === null) {
    return [];
  }

  return [
    {
      id,
      tipo: texto(evento['tipo']) ?? 'EVENTO',
      deEtapa: texto(evento['de_etapa']),
      paraEtapa: texto(evento['para_etapa']),
      ator: texto(evento['ator']) ?? 'SISTEMA',
      motivo: texto(evento['motivo']),
      ocorridoEm: data(evento['ocorrido_em']),
    },
  ];
}

function eventosDe(valor: unknown): readonly EventoBruto[] {
  return lista(valor).flatMap(eventoDe);
}

export function montarPainel(bruto: unknown, agora: Date): PainelDeAtendimento | null {
  const lido = objeto(bruto);
  if (lido === null) {
    return null;
  }

  const pendencias = pendenciasDe(lido['pendencia']);
  const opcoes = opcoesDe(lido['cotacao']);
  const escolhida = texto(lido['opcao_interesse_id']);

  // O cartão é o mesmo da fila, e é bom que seja: o consultor reconhece o que
  // já viu antes de puxar. A pendência dele é a mais urgente das abertas.
  //
  // É esta chamada que decide se há oportunidade: sem `id`, ela devolve nada, e
  // conferir o `id` de novo aqui criaria um segundo lugar para a regra morar.
  const linha = montarLinhaDaFila(
    { ...lido, pendencia: pendencias.filter((p) => !p.resolvida) },
    agora,
  );
  if (linha === null) {
    return null;
  }

  const etapa = lido['etapa'];

  return {
    cartao: montarCartao({ ...linha, planoDeInteresse: planoEscolhido(opcoes, escolhida) }, agora),
    etapa: etapaNaTela(ehEtapa(etapa) ? etapa : 'NOVO'),
    pendencias: montarPendencias(pendencias, agora),
    opcoes: montarOpcoes(opcoes, escolhida),
    linhaDoTempo: montarLinhaDoTempo(eventosDe(lido['oportunidade_evento'])),
  };
}
