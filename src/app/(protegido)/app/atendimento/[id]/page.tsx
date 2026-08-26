import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Estado } from '@/componentes/base/estado';
import { CartaoOportunidade } from '@/componentes/dominio/cartao-oportunidade';
import { LinhaDoTempo } from '@/componentes/dominio/linha-do-tempo';
import { ListaDePendencias } from '@/componentes/dominio/lista-de-pendencias';
import { OpcoesDeCotacao } from '@/componentes/dominio/opcoes-de-cotacao';
import { lerAtendimento } from '@/dados/consultas/atendimento';
import { dataHoraCurta } from '@/nucleo/atendimento/linha-do-tempo';
import type { PainelDeAtendimento } from '@/nucleo/atendimento/painel';
import { FormularioEscolherPlano, FormularioResolver } from './formularios';

export const dynamic = 'force-dynamic';

/**
 * A tela onde o consultor trabalha uma oportunidade (blueprint §9.5).
 *
 * A ordem das seções é a da conversa: quem é o cliente, o que trava, quais são
 * as opções, e só então o histórico. O histórico vem por último de propósito —
 * ele responde "o que já aconteceu?", pergunta que só aparece depois das
 * outras três.
 *
 * Oportunidade invisível para quem pede vira 404, não "sem permissão": dizer
 * que ela existe já é dizer algo sobre a corretora vizinha.
 */
/**
 * As três seções que seguem o cartão, na ordem da conversa: o que trava, quais
 * são as opções, e só então o que já aconteceu.
 */
function Secoes({ id, painel }: { readonly id: string; readonly painel: PainelDeAtendimento }) {
  return (
    <>
      <section>
        <h2>Pendências</h2>
        <ListaDePendencias
          pendencias={painel.pendencias}
          acaoDe={(pendencia) =>
            pendencia.resolvida ? null : (
              <FormularioResolver
                oportunidade={id}
                pendencia={pendencia.id}
                descricao={pendencia.descricao}
              />
            )
          }
        />
      </section>

      <section>
        <h2>Opções de plano</h2>
        <OpcoesDeCotacao
          opcoes={painel.opcoes}
          acaoDe={(opcao) => (
            <FormularioEscolherPlano
              oportunidade={id}
              opcao={opcao.id}
              nomePlano={opcao.nomePlano}
              escolhida={opcao.escolhida}
            />
          )}
        />
      </section>

      <section>
        <h2>Histórico</h2>
        <LinhaDoTempo eventos={painel.linhaDoTempo} formatarData={dataHoraCurta} />
      </section>
    </>
  );
}

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const painel = await lerAtendimento(id);

  if (painel === null) {
    notFound();
  }

  return (
    <>
      <div>
        <p className="apoio">
          <Link href="/app/atendimentos">← Meus atendimentos</Link>
        </p>
        <h1>{painel.cartao.nome}</h1>
        <Estado tom={painel.etapa.tom}>{painel.etapa.rotulo}</Estado>
      </div>

      <CartaoOportunidade cartao={painel.cartao} acao={null} />

      <Secoes id={id} painel={painel} />
    </>
  );
}
