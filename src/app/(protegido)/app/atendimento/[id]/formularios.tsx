'use client';

import { useActionState } from 'react';
import { Aviso } from '@/componentes/base/aviso';
import { Botao } from '@/componentes/base/botao';
import { escolherPlano, resolverPendencia } from './acoes';
import type { EstadoDoAtendimento } from './acoes';

const INICIAL: EstadoDoAtendimento = { erro: null };

interface PropsPendencia {
  readonly oportunidade: string;
  readonly pendencia: string;
  readonly descricao: string;
}

/**
 * Resolver uma pendência.
 *
 * Client Component só pelo estado de envio e pelo erro. Os identificadores vão
 * no formulário e isso é seguro porque a função do banco confere o dono por
 * `auth.uid()` — a UI esconde, o banco bloqueia (§4.1).
 */
export function FormularioResolver({ oportunidade, pendencia, descricao }: PropsPendencia) {
  const [estado, acao, enviando] = useActionState(resolverPendencia, INICIAL);

  return (
    <form action={acao}>
      <input type="hidden" name="oportunidade" value={oportunidade} />
      <input type="hidden" name="pendencia" value={pendencia} />

      {/* O nome vai dentro do botão: "Resolver" repetido oito vezes não diz
          qual pendência para quem navega pela lista de botões. */}
      <Botao type="submit" variante="secundario" enviando={enviando}>
        {enviando ? 'Resolvendo…' : 'Resolver'}
        <span className="apenas-leitor-de-tela"> {descricao}</span>
      </Botao>

      {estado.erro !== null && <Aviso tom="critico">{estado.erro}</Aviso>}
    </form>
  );
}

interface PropsPlano {
  readonly oportunidade: string;
  readonly opcao: string;
  readonly nomePlano: string;
  readonly escolhida: boolean;
}

/** Marcar de novo o mesmo plano desmarca: desfazer precisa ser um toque. */
export function FormularioEscolherPlano({ oportunidade, opcao, nomePlano, escolhida }: PropsPlano) {
  const [estado, acao, enviando] = useActionState(escolherPlano, INICIAL);

  return (
    <form action={acao}>
      <input type="hidden" name="oportunidade" value={oportunidade} />
      {!escolhida && <input type="hidden" name="opcao" value={opcao} />}

      <Botao type="submit" variante={escolhida ? 'discreto' : 'primario'} enviando={enviando}>
        {escolhida ? 'Desmarcar' : 'É este o plano'}
        <span className="apenas-leitor-de-tela"> {nomePlano}</span>
      </Botao>

      {estado.erro !== null && <Aviso tom="critico">{estado.erro}</Aviso>}
    </form>
  );
}
