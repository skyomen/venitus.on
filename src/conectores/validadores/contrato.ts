import type { Resultado } from '../contrato';

/**
 * Validadores externos.
 *
 * A conferência de formato e dígito verificador é nossa e acontece antes
 * (`nucleo/validacao/documento.ts`). O que estes conectores fazem é
 * **enriquecer**: dizer de quem é o CPF, onde fica o CEP, qual é o carro da
 * placa e se o telefone tem WhatsApp ativo.
 */

export interface Pessoa {
  readonly nome: string;
  readonly dataNascimento: string;
  readonly sexo: string;
}

export interface Endereco {
  readonly cep: string;
  readonly logradouro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface ModeloVeiculo {
  readonly marca: string;
  readonly modelo: string;
  readonly anoFabricacao: number;
  readonly anoModelo: number;
  readonly chassi: string;
}

/**
 * A consulta de placa pode devolver mais de um modelo.
 *
 * Quando isso acontece a jornada não escolhe por conta própria: ela volta ao
 * cliente para desambiguar (blueprint §8.3). Escolher errado aqui contamina a
 * cotação inteira.
 */
export interface ConsultaPlaca {
  readonly modelos: readonly ModeloVeiculo[];
}

export interface Validadores {
  consultarCpf(cpf: string): Promise<Resultado<Pessoa>>;
  consultarCep(cep: string): Promise<Resultado<Endereco>>;
  consultarPlaca(placa: string): Promise<Resultado<ConsultaPlaca>>;
  temWhatsapp(telefoneE164: string): Promise<Resultado<boolean>>;
}
