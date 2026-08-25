import { decidirAcao, decidirAposEnvio, decidirAposOutbox } from './decisoes';
import type {
  ContextoDoDisparo,
  Espelho,
  ItemAgendado,
  ItemDeOutbox,
  Mensageiro,
  Relogio,
  RepositorioDoWorker,
} from './portas';

/**
 * O laço de drenagem.
 *
 * Reserva um lote, decide o destino de cada item e aplica. A decisão vive em
 * `decisoes.ts`, que é puro; aqui só se orquestra — o que mantém este arquivo
 * legível mesmo com sete desfechos possíveis por item.
 *
 * Um item que estoura não derruba o lote: a falha é registrada e o próximo
 * segue. Um fornecedor com problema não pode parar a operação inteira.
 */

export interface Dependencias {
  readonly repositorio: RepositorioDoWorker;
  readonly mensageiro: Mensageiro;
  readonly espelho: Espelho;
  readonly relogio: Relogio;
}

export interface Balanco {
  readonly agendamentos: number;
  readonly outbox: number;
  readonly falhas: number;
}

const LOTE = 50;

function chaveDoDisparo(item: ItemAgendado): string {
  return `whatsapp:${item.oportunidadeId}:${item.tipo}`;
}

async function entregar(
  item: ItemAgendado,
  preparado: ContextoDoDisparo,
  comTemplate: boolean,
  mensageiro: Mensageiro,
) {
  const chave = chaveDoDisparo(item);

  return comTemplate && item.template !== undefined
    ? mensageiro.enviarTemplate(chave, preparado.telefoneE164, item.template)
    : mensageiro.enviarTexto(chave, preparado.telefoneE164, preparado.textoContextual);
}

async function aplicarAposEnvio(
  item: ItemAgendado,
  resultado: Awaited<ReturnType<Mensageiro['enviarTexto']>>,
  dependencias: Dependencias,
): Promise<void> {
  const { repositorio, relogio } = dependencias;
  const agora = relogio.agora();

  const decisao = decidirAposEnvio({
    regua: item.regua,
    oportunidadeId: item.oportunidadeId,
    tipoDisparado: item.tipo,
    resultado,
    tentativas: item.tentativas,
    agora,
  });

  if (decisao.tipo === 'AVANCAR') {
    await repositorio.concluirAgendamento(item.id);
    await repositorio.criarProximoPasso(item.oportunidadeId, decisao.proximo);
    return;
  }

  if (decisao.tipo === 'ENCERRAR') {
    await repositorio.concluirAgendamento(item.id);
    await repositorio.encerrarOportunidade(item.oportunidadeId, decisao.encerramento);
    return;
  }

  if (decisao.tipo === 'REAGENDAR') {
    await repositorio.reagendar(item.id, decisao.emSegundos);
    return;
  }

  await repositorio.falharAgendamento(item.id, decisao.motivo);
}

async function processarAgendamento(item: ItemAgendado, dependencias: Dependencias): Promise<void> {
  const { repositorio, mensageiro } = dependencias;
  const preparado = await repositorio.carregarContexto(item);

  // A oportunidade sumiu entre a reserva e o disparo. Sem contexto não há
  // mensagem a enviar, e insistir não traria a oportunidade de volta.
  if (preparado === null) {
    await repositorio.cancelarAgendamento(item.id, 'Oportunidade não encontrada');
    return;
  }

  const acao = decidirAcao(preparado.contexto, {
    template: item.template,
    templateAprovadoEm: preparado.templateAprovadoEm,
  });

  if (acao.tipo === 'CANCELAR') {
    await repositorio.cancelarAgendamento(item.id, acao.motivo);
    return;
  }
  if (acao.tipo === 'REAGENDAR') {
    await repositorio.reagendar(item.id, acao.emSegundos);
    return;
  }
  if (acao.tipo === 'FALHAR') {
    await repositorio.falharAgendamento(item.id, acao.motivo);
    return;
  }

  const resultado = await entregar(item, preparado, acao.comTemplate, mensageiro);
  await aplicarAposEnvio(item, resultado, dependencias);
}

async function processarOutbox(item: ItemDeOutbox, dependencias: Dependencias): Promise<void> {
  const { repositorio, espelho } = dependencias;
  const resultado = await espelho.espelhar(item.chaveIdempotencia, item.espelhamento);
  const decisao = decidirAposOutbox(resultado, item.tentativas);

  if (decisao.tipo === 'ENTREGUE') {
    await repositorio.concluirOutbox(item.id);
    return;
  }
  if (decisao.tipo === 'AGUARDAR_CONECTOR') {
    await repositorio.aguardarConector(item.id);
    return;
  }
  if (decisao.tipo === 'REAGENDAR') {
    await repositorio.falharOutbox(item.id, 'Tentando de novo', decisao.emSegundos);
    return;
  }

  await repositorio.falharOutbox(item.id, decisao.motivo, null);
}

/**
 * Processa um item isolando a falha.
 *
 * Sem isto, um erro inesperado num item derrubaria o lote inteiro — e o item
 * seguinte, que estava saudável, ficaria parado esperando o próximo tique.
 */
async function comIsolamento<T>(
  item: T,
  processar: (item: T) => Promise<void>,
  aoFalhar: (erro: unknown) => void,
): Promise<boolean> {
  try {
    await processar(item);
    return true;
  } catch (erro) {
    aoFalhar(erro);
    return false;
  }
}

export async function drenar(
  dependencias: Dependencias,
  aoFalhar: (erro: unknown) => void = () => {},
): Promise<Balanco> {
  const { repositorio } = dependencias;

  const agendados = await repositorio.reservarAgendamentos(LOTE);
  const pendentes = await repositorio.reservarOutbox(LOTE);

  let falhas = 0;

  for (const item of agendados) {
    const ok = await comIsolamento(item, (i) => processarAgendamento(i, dependencias), aoFalhar);
    if (!ok) {
      falhas += 1;
    }
  }

  for (const item of pendentes) {
    const ok = await comIsolamento(item, (i) => processarOutbox(i, dependencias), aoFalhar);
    if (!ok) {
      falhas += 1;
    }
  }

  return { agendamentos: agendados.length, outbox: pendentes.length, falhas };
}
