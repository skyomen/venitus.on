import type { ReactNode } from 'react';
import type { TomDeEstado } from '@/design/tom';

interface Props {
  readonly tom: TomDeEstado;
  readonly children: ReactNode;
}

/**
 * Estado — marcador de forma e texto, nunca cápsula colorida.
 *
 * Design system §9. A cápsula arredondada vira enfeite, compete com a ação
 * primária e é o padrão mais batido de interface gerada por IA.
 *
 * A forma do marcador carrega o significado junto com a cor: círculo cheio,
 * triângulo, losango, círculo vazado. Cerca de 8% dos homens não distingue
 * verde de vermelho, e a operação inteira depende de ler estado de relance —
 * por isso são três codificações para o mesmo dado.
 *
 * O marcador é desenhado por `::before`, então ele não entra na árvore de
 * acessibilidade: quem usa leitor de tela ouve o texto, que é onde o
 * significado está.
 */
export function Estado({ tom, children }: Props) {
  return (
    <span className="estado" data-tom={tom}>
      <span className="estado-texto">{children}</span>
    </span>
  );
}
