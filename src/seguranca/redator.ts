/**
 * Redator central de dado pessoal.
 *
 * Blueprint §15.2: log, erro e telemetria passam por aqui. Nenhum caminho de log escapa dele.
 * É a única implementação de redação do projeto — duplicar essa lógica em outro lugar é bug.
 */

const OCULTO = '[oculto]';

interface Regra {
  readonly nome: string;
  readonly padrao: RegExp;
  readonly substituto: string;
}

/**
 * A ordem importa: o padrão mais longo vem primeiro, para que um CNPJ não seja
 * parcialmente consumido pela regra de CPF, nem um CPF pela de telefone.
 *
 * Os padrões numéricos usam fronteira de dígito explícita com lookaround. A fronteira
 * de palavra não serve aqui, porque ela considera fronteira a transição entre dígito
 * e pontuação — e foi exatamente assim que a regra de telefone chegou a comer o meio
 * de um CPF.
 *
 * Ambiguidade aceita: um celular com DDD tem 11 dígitos, igual a um CPF. Sem contexto
 * não há como distinguir os dois, e o rótulo pode errar. O que importa é que ambos são
 * ocultados — o rótulo é aproximado, a redação não.
 */
const REGRAS: readonly Regra[] = [
  {
    nome: 'cnpj',
    padrao: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g,
    substituto: '[cnpj]',
  },
  {
    nome: 'cpf',
    padrao: /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g,
    substituto: '[cpf]',
  },
  {
    nome: 'telefone',
    padrao: /(?<!\d)(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[-\s]?\d{4}(?!\d)/g,
    substituto: '[telefone]',
  },
  {
    nome: 'email',
    padrao: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    substituto: '[email]',
  },
  {
    nome: 'placa',
    padrao: /\b[A-Z]{3}-?\d[A-Z\d]\d{2}\b/g,
    substituto: '[placa]',
  },
  {
    nome: 'portador',
    padrao: /\bBearer\s+[\w.+/=-]+/gi,
    substituto: 'Bearer [oculto]',
  },
];

/** Nome de campo que carrega dado sensível. A comparação é por conteúdo, não por igualdade. */
const CHAVES_SENSIVEIS: readonly string[] = [
  'senha',
  'password',
  'token',
  'authorization',
  'secret',
  'segredo',
  'apikey',
  'api_key',
  'cpf',
  'cnpj',
  'telefone',
  'email',
  'placa',
  'chassi',
  'cnh',
  'crlv',
  'apolice',
  'cartao',
];

export function ehChaveSensivel(chave: string): boolean {
  const normalizada = chave.toLowerCase();
  return CHAVES_SENSIVEIS.some((sensivel) => normalizada.includes(sensivel));
}

/** Aplica todas as regras a um texto livre. */
export function redigirTexto(texto: string): string {
  return REGRAS.reduce(
    (acumulado, regra) => acumulado.replace(regra.padrao, regra.substituto),
    texto,
  );
}

/**
 * Redige qualquer valor antes de ele virar log.
 *
 * Campo com nome sensível é ocultado inteiro, sem tentar reconhecer o formato:
 * confiar no padrão de um campo chamado `cpf` seria apostar que ele sempre vem formatado.
 */
export function redigir(valor: unknown): unknown {
  if (typeof valor === 'string') {
    return redigirTexto(valor);
  }
  if (Array.isArray(valor)) {
    return valor.map(redigir);
  }
  if (valor instanceof Error) {
    return { nome: valor.name, mensagem: redigirTexto(valor.message) };
  }
  if (valor !== null && typeof valor === 'object') {
    return redigirRegistro(valor as Record<string, unknown>);
  }
  return valor;
}

function redigirRegistro(registro: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(registro)) {
    saida[chave] = ehChaveSensivel(chave) ? OCULTO : redigir(valor);
  }
  return saida;
}
