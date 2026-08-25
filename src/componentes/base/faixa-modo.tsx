import { rotuloDoModo } from '@/seguranca/modo-dados';
import type { ModoDados } from '@/seguranca/modo-dados';

/**
 * Faixa de modo de dados.
 *
 * Nunca discreta, e nunca escondida: ela existe para impedir que alguém trate
 * registro de produção como descartável (blueprint §18).
 */
export function FaixaModo({ modo }: { readonly modo: ModoDados }) {
  return (
    <div className="faixa-modo" data-modo={modo} role="status">
      {rotuloDoModo(modo)}
    </div>
  );
}
