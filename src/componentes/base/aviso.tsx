import type { ReactNode } from 'react';

interface Props {
  readonly tom?: 'neutro' | 'critico';
  readonly titulo?: string;
  readonly children: ReactNode;
}

/**
 * Aviso.
 *
 * `role="alert"` no tom crítico porque o leitor de tela precisa anunciar a falha
 * assim que ela aparece; o tom neutro é informação e não interrompe a leitura.
 */
export function Aviso({ tom = 'neutro', titulo, children }: Props) {
  return (
    <div className="aviso" data-tom={tom} role={tom === 'critico' ? 'alert' : 'status'}>
      {titulo !== undefined && <strong className="aviso-titulo">{titulo}</strong>}
      <span>{children}</span>
    </div>
  );
}
