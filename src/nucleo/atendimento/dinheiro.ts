/**
 * Dinheiro na tela.
 *
 * `Intl.NumberFormat` resolveria, e usa espaço fino não separável entre "R$" e
 * o número — invisível no navegador, e invisível também no teste que procura
 * "R$ 1.234,56" e não encontra. Formatar à mão custa dez linhas e não depende
 * da versão do ICU embarcada no runtime.
 *
 * Prêmio é o número que decide a venda: mostrá-lo errado, ou não mostrá-lo, é
 * pior do que não ter a tela.
 */

/** Devolve nada quando não há valor: "R$ 0,00" mentiria sobre um plano sem preço. */
export function emReais(valor: number | null | undefined): string | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return null;
  }

  const centavos = Math.round(Math.abs(valor) * 100);
  const inteiro = Math.trunc(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const sinal = valor < 0 ? '-' : '';

  return `${sinal}R$ ${agruparMilhares(inteiro)},${resto}`;
}

function agruparMilhares(inteiro: number): string {
  const digitos = String(inteiro);
  let agrupado = '';

  for (let i = 0; i < digitos.length; i += 1) {
    const faltam = digitos.length - i;
    agrupado += digitos[i];
    if (faltam > 1 && (faltam - 1) % 3 === 0) {
      agrupado += '.';
    }
  }

  return agrupado;
}
