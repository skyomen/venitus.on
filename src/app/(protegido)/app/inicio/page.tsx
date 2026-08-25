import { Placa } from '@/componentes/base/placa';
import { Botao } from '@/componentes/base/botao';
import { obterSessao } from '@/seguranca/sessao';

// A tela responde a uma pergunta: "o que eu preciso fazer agora?".
// A ação vem antes do relatório. Os números chegam na fatia 5, com a fila.
export default async function Pagina() {
  const sessao = await obterSessao();

  return (
    <>
      <div>
        <h1>Bom dia</h1>
        <p className="apoio">{sessao?.email}</p>
      </div>

      <div className="grade-placas">
        <Placa valor="—" descricao="clientes quentes" tom="quente" />
        <Placa valor="—" descricao="aguardando atendimento" />
        <Placa valor="—" descricao="cotações em andamento" />
        <Placa valor="—" descricao="propostas com pendência" tom="atencao" />
      </div>

      <div>
        <Botao variante="primario" disabled>
          Atender Próximo Cliente
        </Botao>
        <p className="apoio" style={{ marginTop: 'var(--e2)' }}>
          A fila entra na fatia 5 do plano.
        </p>
      </div>
    </>
  );
}
