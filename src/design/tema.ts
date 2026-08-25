/**
 * Tema claro e escuro.
 *
 * Três estados, não dois: `sistema` deixa o sistema operacional decidir, e é o
 * padrão. Só a escolha explícita marca o documento — assim quem nunca abriu a
 * preferência continua acompanhando o aparelho.
 *
 * A escolha vive em cookie e é aplicada no servidor. Sem isso a página abriria
 * no tema errado e piscaria ao corrigir.
 */

export const TEMAS = ['sistema', 'claro', 'escuro'] as const;

export type Tema = (typeof TEMAS)[number];

export const COOKIE_TEMA = 'venitus-tema';

/** O rótulo nomeia o tema, sem prefixo: ele aparece como texto do botão. */
const ROTULOS: Readonly<Record<Tema, string>> = {
  sistema: 'Sistema',
  claro: 'Claro',
  escuro: 'Escuro',
};

export function ehTema(valor: unknown): valor is Tema {
  return typeof valor === 'string' && (TEMAS as readonly string[]).includes(valor);
}

/** Valor desconhecido ou ausente volta para `sistema`, que nunca está errado. */
export function interpretarTema(valor: unknown): Tema {
  return ehTema(valor) ? valor : 'sistema';
}

/**
 * O atributo que vai no elemento raiz.
 *
 * `sistema` não marca nada: é a ausência do atributo que deixa a consulta de
 * mídia decidir. Marcar com "sistema" quebraria o seletor de tema no CSS.
 */
export function atributoDoTema(tema: Tema): string | undefined {
  return tema === 'sistema' ? undefined : tema;
}

/**
 * O próximo tema do ciclo: sistema → claro → escuro → sistema.
 *
 * Um ciclo de três, e não um interruptor de dois, por duas razões. A primeira é
 * que `sistema` precisa continuar alcançável — com dois estados, quem alternasse
 * uma vez nunca mais voltaria a acompanhar o aparelho. A segunda é que o rótulo
 * passa a nomear o estado atual em vez de um destino: um botão que promete
 * "Claro" enquanto o sistema já está claro anuncia algo que não acontece.
 */
const CICLO: Readonly<Record<Tema, Tema>> = {
  sistema: 'claro',
  claro: 'escuro',
  escuro: 'sistema',
};

export function proximoTema(atual: Tema): Tema {
  return CICLO[atual];
}

export function rotuloDoTema(tema: Tema): string {
  return ROTULOS[tema];
}

/** O que o leitor de tela anuncia: onde está e para onde vai. */
export function descricaoDoSeletor(atual: Tema): string {
  return `${ROTULOS[atual]}. Alternar para ${ROTULOS[proximoTema(atual)].toLowerCase()}.`;
}
