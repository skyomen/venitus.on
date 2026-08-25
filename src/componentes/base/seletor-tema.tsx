import { descricaoDoSeletor, rotuloDoTema } from '@/design/tema';
import type { Tema } from '@/design/tema';

interface Props {
  readonly tema: Tema;
  readonly aoAlternar: () => void | Promise<void>;
}

/**
 * Alternador de tema.
 *
 * O rótulo nomeia o tema **em vigor**, não um destino. Nomear o destino exigiria
 * saber o que o sistema operacional está mostrando — o que só o navegador sabe —
 * e um botão que promete "Claro" enquanto a tela já está clara anuncia algo que
 * não acontece.
 *
 * Como o rótulo não depende do navegador, este componente roda no servidor e a
 * troca funciona sem JavaScript.
 */
export function SeletorTema({ tema, aoAlternar }: Props) {
  return (
    <form action={aoAlternar}>
      <button type="submit" className="ligacao" aria-label={descricaoDoSeletor(tema)}>
        {rotuloDoTema(tema)}
      </button>
    </form>
  );
}
