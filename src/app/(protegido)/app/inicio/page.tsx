import Link from 'next/link';
import { Placa } from '@/componentes/base/placa';
import { lerResumoDoConsultor } from '@/dados/consultas/resumo';
import { exigirAcesso } from '@/seguranca/sessao';

export const dynamic = 'force-dynamic';

// A tela responde a uma pergunta: "o que eu preciso fazer agora?".
// A ação vem antes do relatório, e cada número é um número sobre o qual dá para
// agir — nenhum deles está aqui como enfeite de painel.
export default async function Pagina() {
  const sessao = await exigirAcesso('/app');
  const resumo = await lerResumoDoConsultor(sessao.usuarioId);

  return (
    <>
      <div>
        <h1>Bom dia</h1>
        <p className="apoio">{sessao.email}</p>
      </div>

      <div className="grade-placas">
        <Placa valor={String(resumo.quentesNaFila)} descricao="clientes quentes" tom="quente" />
        <Placa valor={String(resumo.aguardando)} descricao="aguardando atendimento" />
        <Placa valor={String(resumo.meusAtendimentos)} descricao="atendimentos meus em aberto" />
        <Placa
          valor={String(resumo.minhasPendencias)}
          descricao="pendências abertas"
          tom={resumo.minhasPendencias > 0 ? 'atencao' : 'neutro'}
        />
      </div>

      <div>
        <Link href="/app/fila" className="botao botao--primario botao--largo">
          Ir para a fila
        </Link>
      </div>
    </>
  );
}
