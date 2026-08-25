import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/dados/cliente-admin';
import { assinaturaConfere, interpretarLead } from '@/nucleo/lead/webhook';
import { redigir } from '@/seguranca/redator';

/**
 * Entrada de lead por webhook (blueprint §10.4).
 *
 * A assinatura é conferida antes de qualquer processamento, o corpo cru é
 * persistido antes de ser interpretado, e a resposta é imediata — quem entrega
 * webhook reentrega quando demora, e reentrega duplicaria a jornada.
 *
 * O tenant vem do canal, nunca de um campo do corpo (§6.8).
 */
export async function POST(requisicao: Request): Promise<NextResponse> {
  const corpoCru = await requisicao.text();

  if (
    !assinaturaConfere(
      corpoCru,
      requisicao.headers.get('x-venitus-assinatura'),
      process.env.WEBHOOK_SEGREDO_MIDIA,
    )
  ) {
    // Sem detalhe: dizer o que falhou ajudaria quem está tentando adivinhar.
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ erro: 'Corpo não é JSON válido.' }, { status: 400 });
  }

  const lead = interpretarLead(corpo);
  if (lead === null) {
    return NextResponse.json({ erro: 'Informe canal e nome.' }, { status: 400 });
  }

  const supabase = criarClienteAdmin();
  const { data, error } = await supabase.rpc('receber_lead', {
    p_chave_canal: lead.chaveCanal,
    p_nome: lead.nome,
    p_telefone: lead.telefone,
    p_cpf: lead.cpf,
    p_corpo: corpo,
  });

  if (error !== null) {
    console.error('falha ao receber lead', redigir({ mensagem: error.message }));
    return NextResponse.json({ erro: 'Não foi possível registrar o lead.' }, { status: 500 });
  }

  // Canal desconhecido vai para quarentena e devolve 202: o lead foi aceito para
  // análise, mas não virou oportunidade. Devolver erro faria a origem reenviar
  // para sempre o que nunca terá dono.
  //
  // A função devolve NULL nesse caso, mas o PostgREST expande o composto e
  // entrega um objeto com todos os campos nulos — testar `data === null` daria
  // sempre falso e a quarentena passaria por sucesso.
  const oportunidade = data as { id?: string | null } | null;
  const emQuarentena = oportunidade?.id === undefined || oportunidade.id === null;

  return NextResponse.json(
    { situacao: emQuarentena ? 'EM_QUARENTENA' : 'RECEBIDO' },
    { status: emQuarentena ? 202 : 201 },
  );
}
