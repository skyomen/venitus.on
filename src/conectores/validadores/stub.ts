import { falha, sucesso } from '../contrato';
import type { Resultado } from '../contrato';
import { cepValido, cpfValido, placaValida, normalizarPlaca } from '@/nucleo/validacao/documento';
import type { ConsultaPlaca, Endereco, Pessoa, Validadores } from './contrato';

/**
 * Validadores em modo stub.
 *
 * Cumpre o mesmo contrato da implementação real: valida a entrada com o mesmo
 * rigor e recusa o que a API real recusaria. Um payload que o stub aceita e a
 * API real rejeitaria é defeito do contrato — e é isso que o teste de contrato
 * existe para pegar.
 *
 * As respostas são sintéticas e derivadas da própria entrada, para que a mesma
 * consulta devolva sempre a mesma coisa. Resposta aleatória tornaria o
 * desenvolvimento imprevisível sem tornar o teste mais realista.
 */

/** Deriva um número estável da entrada, para respostas repetíveis. */
function semente(valor: string): number {
  let total = 0;
  for (const caractere of valor) {
    total = (total * 31 + caractere.charCodeAt(0)) % 100_000;
  }
  return total;
}

function escolher<T>(opcoes: readonly T[], chave: string): T {
  return opcoes[semente(chave) % opcoes.length] as T;
}

const NOMES = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Alves', 'Elisa Rocha'] as const;
const CIDADES = [
  { cidade: 'São Paulo', uf: 'SP' },
  { cidade: 'Belo Horizonte', uf: 'MG' },
  { cidade: 'Curitiba', uf: 'PR' },
] as const;
const MARCAS = [
  { marca: 'Chevrolet', modelo: 'Tracker Premier 1.2 Turbo' },
  { marca: 'Renault', modelo: 'Kwid Outsider 1.0 Flex' },
  { marca: 'Fiat', modelo: 'Argo Drive 1.3' },
] as const;

/**
 * Placas terminadas em 9 devolvem dois modelos.
 *
 * A desambiguação é um caminho real da jornada e precisa ser exercitável em
 * desenvolvimento; sem um gatilho previsível, ela só apareceria em produção.
 */
function devolveDoisModelos(placa: string): boolean {
  return placa.endsWith('9');
}

export function criarValidadoresStub(): Validadores {
  return {
    async consultarCpf(cpf: string): Promise<Resultado<Pessoa>> {
      if (!cpfValido(cpf)) {
        return falha('PAYLOAD_INVALIDO', 'CPF com dígito verificador inválido', 'cpf');
      }

      const dia = String((semente(cpf) % 28) + 1).padStart(2, '0');
      return sucesso(
        {
          nome: escolher(NOMES, cpf),
          dataNascimento: `19${String((semente(cpf) % 40) + 60)}-05-${dia}`,
          sexo: semente(cpf) % 2 === 0 ? 'F' : 'M',
        },
        'STUB',
      );
    },

    async consultarCep(cep: string): Promise<Resultado<Endereco>> {
      if (!cepValido(cep)) {
        return falha('PAYLOAD_INVALIDO', 'CEP precisa ter 8 dígitos', 'cep');
      }

      const local = escolher(CIDADES, cep);
      return sucesso({ cep, logradouro: `Rua Sintética ${semente(cep) % 900}`, ...local }, 'STUB');
    },

    async consultarPlaca(placa: string): Promise<Resultado<ConsultaPlaca>> {
      if (!placaValida(placa)) {
        return falha('PAYLOAD_INVALIDO', 'Placa fora do formato antigo e do Mercosul', 'placa');
      }

      const normalizada = normalizarPlaca(placa);
      const base = escolher(MARCAS, normalizada);
      const ano = 2015 + (semente(normalizada) % 10);

      const primeiro = {
        ...base,
        anoFabricacao: ano,
        anoModelo: ano + 1,
        chassi: `9BW${normalizada}${semente(normalizada)}`,
      };

      if (!devolveDoisModelos(normalizada)) {
        return sucesso({ modelos: [primeiro] }, 'STUB');
      }

      const segundo = { ...primeiro, modelo: `${base.modelo} Automático` };
      return sucesso({ modelos: [primeiro, segundo] }, 'STUB');
    },

    async temWhatsapp(telefoneE164: string): Promise<Resultado<boolean>> {
      if (!/^\+55\d{10,11}$/.test(telefoneE164)) {
        return falha('PAYLOAD_INVALIDO', 'Telefone precisa estar em E.164', 'telefone');
      }

      // Telefones terminados em 0 não têm WhatsApp: é assim que o caminho de
      // "não contatável" fica exercitável sem esperar um caso real.
      return sucesso(!telefoneE164.endsWith('0'), 'STUB');
    },
  };
}
