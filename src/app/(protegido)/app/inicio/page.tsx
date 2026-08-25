import { obterSessao } from '@/seguranca/sessao';

// A home responde a uma pergunta: "o que eu preciso fazer agora?" (blueprint §5.4).
// Os números chegam na fatia 5, quando a fila existir.
export default async function Pagina() {
  const sessao = await obterSessao();

  return (
    <>
      <h1>Bom dia</h1>
      <p className="apoio">{sessao?.email}</p>

      <ul className="painel">
        <li>
          <strong>—</strong> clientes quentes
        </li>
        <li>
          <strong>—</strong> aguardando atendimento
        </li>
        <li>
          <strong>—</strong> cotações em andamento
        </li>
        <li>
          <strong>—</strong> propostas com pendência
        </li>
      </ul>

      <button type="button" className="acao" disabled>
        Atender próximo cliente
      </button>
      <p className="apoio">A fila entra na fatia 5.</p>
    </>
  );
}
