import 'server-only';

import { obterCanalWhatsapp, obterCrm } from '@/conectores/registro';
import { criarClienteAdmin } from '@/dados/cliente-admin';
import { redigirTexto } from '@/seguranca/redator';
import { drenar } from './drenar';
import type { Balanco } from './drenar';
import { criarEspelho, criarMensageiro } from './supabase/conectores';
import { criarRepositorio } from './supabase/repositorio';

/**
 * Um tique do worker.
 *
 * Monta as dependências, drena um lote e devolve o balanço. É composição: toda
 * decisão vive em `decisoes.ts`, todo laço em `drenar.ts`, toda tradução em
 * `supabase/mapeamento.ts` — os três puros e cobertos.
 *
 * Roda a cada minuto (`vercel.json`). Dois tiques sobrepostos não se atrapalham:
 * a reserva usa `for update skip locked`, então o segundo pega o que o primeiro
 * não pegou em vez de esperar.
 *
 * Enquanto as APIs reais não existem, as duas famílias vêm em `stub`, que grava
 * a intenção e diz que não entregou (§10.5). A escolha por corretora entra
 * quando houver o que escolher.
 */
export async function executarTique(): Promise<Balanco> {
  const supabase = criarClienteAdmin();

  const balanco = await drenar(
    {
      repositorio: criarRepositorio(supabase),
      mensageiro: criarMensageiro(obterCanalWhatsapp('stub')),
      espelho: criarEspelho(obterCrm('stub')),
      relogio: { agora: () => new Date() },
    },
    // Um item que estoura não derruba o lote, mas também não some: o log é o
    // único lugar onde uma falha isolada aparece.
    (erro) => {
      console.error('worker: item falhou', redigirTexto(String(erro)));
    },
  );

  return balanco;
}
