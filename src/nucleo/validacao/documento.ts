/**
 * Validação de formato e dígito verificador.
 *
 * Isto é lógica nossa, não chamada externa. O conector de validadores enriquece
 * — devolve nome, data de nascimento, marca e modelo. Conferir se o número é
 * bem formado acontece antes, de graça, e evita gastar uma chamada externa com
 * um dado que já sabemos estar errado.
 */

function digitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * CPF: onze dígitos com dois verificadores.
 *
 * Sequências repetidas passam no cálculo dos verificadores — `111.111.111-11` é
 * aritmeticamente válido — e por isso são recusadas à parte.
 */
export function cpfValido(valor: unknown): boolean {
  if (typeof valor !== 'string') {
    return false;
  }

  const numero = digitos(valor);

  if (numero.length !== 11 || /^(\d)\1{10}$/.test(numero)) {
    return false;
  }

  return verificador(numero, 9) === numero[9] && verificador(numero, 10) === numero[10];
}

function verificador(numero: string, ate: number): string {
  let soma = 0;
  for (let i = 0; i < ate; i += 1) {
    soma += Number(numero[i]) * (ate + 1 - i);
  }

  const resto = (soma * 10) % 11;
  return String(resto === 10 ? 0 : resto);
}

/** CEP: oito dígitos. A existência do endereço é pergunta para o conector. */
export function cepValido(valor: unknown): boolean {
  return typeof valor === 'string' && digitos(valor).length === 8;
}

export function normalizarCep(valor: string): string {
  return digitos(valor);
}

const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Placa: o formato antigo e o Mercosul convivem, e os dois continuam válidos. */
export function placaValida(valor: unknown): boolean {
  if (typeof valor !== 'string') {
    return false;
  }

  const placa = normalizarPlaca(valor);
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa);
}

export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Telefone em E.164.
 *
 * A operação recebe telefone em todo formato imaginável, e o mesmo número
 * escrito de dois jeitos criaria dois contatos — quebrando a regra de que
 * contato não duplica (blueprint §8.4). Por isso normalizar é obrigatório na
 * entrada, e não um detalhe de apresentação.
 */
export function normalizarTelefone(valor: unknown): string | null {
  if (typeof valor !== 'string') {
    return null;
  }

  let numero = digitos(valor);

  // Alguns canais entregam com o zero de operadora na frente.
  if (numero.startsWith('0')) {
    numero = numero.slice(1);
  }
  if (numero.startsWith('55') && numero.length > 11) {
    numero = numero.slice(2);
  }

  // Dez dígitos é fixo; onze é celular, e o nono dígito precisa ser 9.
  if (numero.length === 11 && numero[2] !== '9') {
    return null;
  }
  if (numero.length !== 10 && numero.length !== 11) {
    return null;
  }

  // DDD brasileiro vai de 11 a 99.
  if (Number(numero.slice(0, 2)) < 11) {
    return null;
  }

  return `+55${numero}`;
}
