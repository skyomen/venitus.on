import Link from 'next/link';
import { CartaoOportunidade } from '@/componentes/dominio/cartao-oportunidade';
import { lerMeusAtendimentos } from '@/dados/consultas/atendimentos';
import { exigirAcesso } from '@/seguranca/sessao';

export const dynamic = 'force-dynamic';

/**
 * O que já é meu.
 *
 * Daqui em diante o SLA é de uma pessoa (§1.3), e o dono da conversa é o
 * consultor — a automação silenciou na atribuição (§11.5).
 */
export default async function Pagina() {
  const sessao = await exigirAcesso('/app');
  const atendimentos = await lerMeusAtendimentos(sessao.usuarioId);

  return (
    <>
      <div>
        <h1>Meus atendimentos</h1>
        <p className="apoio">
          {atendimentos.length === 0
            ? 'Nada em aberto com você.'
            : `${atendimentos.length} em aberto.`}
        </p>
      </div>

      {atendimentos.length === 0 ? (
        <div className="vazio">
          <strong>Nenhum atendimento em aberto.</strong>
          <p className="apoio">
            Puxe o próximo cliente na fila e ele aparece aqui, com o contexto da conversa.
          </p>
        </div>
      ) : (
        <div className="fila">
          {atendimentos.map((cartao) => (
            <CartaoOportunidade
              key={cartao.id}
              cartao={cartao}
              acao={
                <Link href={`/app/atendimento/${cartao.id}`} className="botao botao--primario">
                  Abrir atendimento
                </Link>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
