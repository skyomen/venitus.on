import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  readonly variante?: Variante;
  readonly largo?: boolean;
  readonly enviando?: boolean;
  readonly children: ReactNode;
}

/**
 * Botão do sistema.
 *
 * O envio **não** desabilita o botão: ele troca de estado. Desabilitar antes da
 * requisição começar esconde o erro de validação de quem precisa vê-lo, e some
 * com o alvo debaixo do dedo no meio do toque.
 */
export function Botao({ variante = 'secundario', largo, enviando, children, ...resto }: Props) {
  const classes = ['botao', `botao--${variante}`, largo === true ? 'botao--largo' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...resto}
      className={classes}
      data-estado={enviando === true ? 'enviando' : undefined}
      aria-busy={enviando === true ? true : undefined}
    >
      {children}
    </button>
  );
}
