import { NextResponse } from 'next/server';
import { cronAutorizado } from '@/worker/cron';
import { executarTique } from '@/worker/executar';
import { redigirTexto } from '@/seguranca/redator';

/**
 * O tique do worker (blueprint §11.3).
 *
 * A Vercel chama esta rota a cada minuto com `Authorization: Bearer
 * $CRON_SECRET` (`vercel.json`). Sem esse cabeçalho a resposta é 401 — e é 401
 * também quando o segredo não está configurado, porque um erro de implantação
 * não pode virar porta aberta.
 */
export async function GET(requisicao: Request): Promise<NextResponse> {
  if (!cronAutorizado(requisicao.headers.get('authorization'), process.env.CRON_SECRET)) {
    // Sem detalhe: dizer o que falhou ajudaria quem está tentando adivinhar.
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await executarTique());
  } catch (erro) {
    console.error('worker: tique falhou', redigirTexto(String(erro)));
    return NextResponse.json({ erro: 'O tique do worker falhou.' }, { status: 500 });
  }
}
