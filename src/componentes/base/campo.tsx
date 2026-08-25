import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  readonly id: string;
  readonly rotulo: string;
  readonly dica?: string;
  readonly erro?: string;
}

/**
 * Campo de formulário.
 *
 * O rótulo é sempre visível e clicável — placeholder é exemplo de formato, não
 * substituto de rótulo. Quando há erro, ele fica ao lado do campo e o `input`
 * aponta para ele, para que o leitor de tela anuncie os dois juntos.
 */
export function Campo({ id, rotulo, dica, erro, ...resto }: Props) {
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descricao = [erro !== undefined ? idErro : '', dica !== undefined ? idDica : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="campo" data-estado={erro !== undefined ? 'erro' : undefined}>
      <label className="campo-rotulo" htmlFor={id}>
        {rotulo}
      </label>

      <input
        {...resto}
        id={id}
        aria-invalid={erro !== undefined ? true : undefined}
        aria-describedby={descricao === '' ? undefined : descricao}
      />

      {dica !== undefined && (
        <span className="campo-dica" id={idDica}>
          {dica}
        </span>
      )}

      {erro !== undefined && (
        <span className="campo-erro" id={idErro} role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
