import { etapaDaDecisao, proximoPasso } from './cadeia';
import type { DadosDoLead, Decisao, RespostasExternas } from './cadeia';
import type { ModeloVeiculo, Validadores } from '@/conectores/validadores/contrato';
import type { Falha } from '@/conectores/contrato';

/**
 * Executa a validação em cadeia contra os conectores.
 *
 * A decisão de qual passo vem a seguir é de `cadeia.ts`, que é puro. Este módulo
 * só faz as perguntas e devolve as respostas para ele — recebendo os conectores
 * por parâmetro, o que o mantém testável com stub ou com real, sem mudar nada.
 */

export interface Enriquecimento {
  readonly nome?: string;
  readonly dataNascimento?: string;
  readonly sexo?: string;
  readonly cidade?: string;
  readonly uf?: string;
  readonly modelos?: readonly ModeloVeiculo[];
}

export interface ResultadoCadeia {
  readonly decisao: Decisao;
  readonly etapa: 'EM_VALIDACAO' | 'AGUARDANDO_DADO' | 'QUALIFICADO';
  readonly contatavel: boolean;
  readonly enriquecimento: Enriquecimento;
  /** Preenchida quando um conector falhou por indisponibilidade, não por conteúdo. */
  readonly falha?: Falha;
}

/**
 * Cada passo da cadeia consulta no máximo um conector, e a cadeia tem cinco
 * passos. O limite existe para que um conector que responda de forma
 * inconsistente não gire para sempre.
 */
const MAXIMO_DE_VOLTAS = 8;

interface Estado {
  respostas: RespostasExternas;
  enriquecimento: Enriquecimento;
  contatavel: boolean;
  falha?: Falha;
}

async function consultarTelefone(
  telefone: string,
  validadores: Validadores,
  estado: Estado,
): Promise<boolean> {
  const resposta = await validadores.temWhatsapp(telefone);
  if (!resposta.ok) {
    estado.falha = resposta.falha;
    return false;
  }

  estado.respostas = { ...estado.respostas, temWhatsapp: resposta.valor };
  estado.contatavel = resposta.valor;
  return true;
}

async function consultarPlaca(
  placa: string,
  validadores: Validadores,
  estado: Estado,
): Promise<boolean> {
  const resposta = await validadores.consultarPlaca(placa);
  if (!resposta.ok) {
    estado.falha = resposta.falha;
    return false;
  }

  estado.respostas = { ...estado.respostas, modelosDaPlaca: resposta.valor.modelos.length };
  estado.enriquecimento = { ...estado.enriquecimento, modelos: resposta.valor.modelos };
  return true;
}

/** Enriquece com o que os validadores sabem, sem alterar a decisão da cadeia. */
async function enriquecer(
  dados: DadosDoLead,
  validadores: Validadores,
  estado: Estado,
): Promise<void> {
  if (dados.cpf !== undefined) {
    const pessoa = await validadores.consultarCpf(dados.cpf);
    if (pessoa.ok) {
      estado.enriquecimento = { ...estado.enriquecimento, ...pessoa.valor };
    }
  }

  if (dados.cep !== undefined) {
    const endereco = await validadores.consultarCep(dados.cep);
    if (endereco.ok) {
      estado.enriquecimento = {
        ...estado.enriquecimento,
        cidade: endereco.valor.cidade,
        uf: endereco.valor.uf,
      };
    }
  }
}

export async function executarCadeia(
  dados: DadosDoLead,
  validadores: Validadores,
): Promise<ResultadoCadeia> {
  const estado: Estado = { respostas: {}, enriquecimento: {}, contatavel: true };
  let decisao = proximoPasso(dados, estado.respostas);

  for (let volta = 0; decisao.tipo === 'CONSULTAR' && volta < MAXIMO_DE_VOLTAS; volta += 1) {
    const seguiu =
      decisao.passo === 'TELEFONE'
        ? await consultarTelefone(decisao.valor, validadores, estado)
        : await consultarPlaca(decisao.valor, validadores, estado);

    // Conector que não respondeu interrompe a cadeia: insistir aqui só
    // multiplicaria a chamada que já falhou.
    if (!seguiu) {
      break;
    }
    decisao = proximoPasso(dados, estado.respostas);
  }

  await enriquecer(dados, validadores, estado);

  return {
    decisao,
    etapa: etapaDaDecisao(decisao),
    contatavel: estado.contatavel,
    enriquecimento: estado.enriquecimento,
    ...(estado.falha === undefined ? {} : { falha: estado.falha }),
  };
}
