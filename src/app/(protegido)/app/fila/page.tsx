import { CartaoOportunidade } from '@/componentes/dominio/cartao-oportunidade';
import { lerFila } from '@/dados/consultas/fila';
import { BotaoAtender } from './botao-atender';

export const dynamic = 'force-dynamic';

/**
 * A fila comercial.
 *
 * **A fila entrega; o consultor não escolhe.** Por isso não há botão por
 * cartão: escolher a dedo desmontaria a ordem de prioridade de §9.4, e o lead
 * frio que envelhece nunca mais seria atendido. Os cartões estão aqui para o
 * consultor saber o que vem — e para o gestor ver que a fila anda.
 */
export default async function Pagina() {
  const fila = await lerFila();

  return (
    <>
      <div>
        <h1>Fila</h1>
        <p className="apoio">
          {fila.length === 0
            ? 'Ninguém aguardando.'
            : `${fila.length} ${fila.length === 1 ? 'cliente aguardando' : 'clientes aguardando'}.`}
        </p>
      </div>

      <BotaoAtender />

      {fila.length === 0 ? (
        <div className="vazio">
          <strong>Nenhum cliente aguardando.</strong>
          <p className="apoio">
            Assim que um lead for qualificado, ele aparece aqui — na ordem em que a fila decidir.
          </p>
        </div>
      ) : (
        <div className="fila">
          {fila.map((cartao, indice) => (
            <CartaoOportunidade
              key={cartao.id}
              cartao={cartao}
              acao={
                <p className="apoio">
                  {indice === 0 ? 'É o próximo a ser atendido.' : `${indice + 1}º da fila.`}
                </p>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
