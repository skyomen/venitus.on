/**
 * Os quatro tons de estado (design system §9).
 *
 * Vive aqui, e não dentro do componente, porque quem **decide** o tom é o
 * núcleo — a espera que passou do limite, a pendência vencida — e quem apenas o
 * desenha é a tela. Deixar o tipo no componente faria o núcleo depender da
 * apresentação para dizer uma coisa que é dele.
 *
 * Cada tom tem forma própria no marcador: círculo cheio, triângulo, losango e
 * círculo vazado. Cor sozinha nunca identifica estado.
 */
export const TONS_DE_ESTADO = ['bom', 'atencao', 'critico', 'neutro'] as const;

export type TomDeEstado = (typeof TONS_DE_ESTADO)[number];
