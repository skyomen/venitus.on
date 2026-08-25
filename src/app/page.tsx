import { redirect } from 'next/navigation';
import { obterSessao } from '@/seguranca/sessao';
import { ROTA_LOGIN, rotaInicialDe } from '@/seguranca/autorizacao';

// A raiz não tem conteúdo próprio: ela encaminha para a área de quem chegou.
export default async function Pagina() {
  const sessao = await obterSessao();
  redirect(sessao === null ? ROTA_LOGIN : rotaInicialDe(sessao.papel));
}
