import type { Metadata } from 'next';
import { FormularioCodigo } from '../formulario-codigo';
import { sessaoParaMfa } from '../sessao-mfa';

export const metadata: Metadata = { title: 'Segundo fator · Venitus.on' };

export default async function Pagina() {
  const { supabase } = await sessaoParaMfa();

  // Descarta cadastros iniciados e abandonados antes de abrir um novo.
  //
  // Sem isto, cada visita a esta tela deixa mais um fator pendente para trás, e
  // ao bater o limite de fatores por usuário o cadastro passa a falhar de vez —
  // trancando fora justamente quem precisa do segundo fator para entrar.
  const fatores = await supabase.auth.mfa.listFactors();
  for (const pendente of fatores.data?.all.filter((f) => f.status !== 'verified') ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: pendente.id });
  }

  const inscricao = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Venitus.on',
  });

  if (inscricao.error !== null) {
    return (
      <main className="centralizado">
        <div className="cartao">
          <h1>Segundo fator</h1>
          <p className="erro" role="alert">
            Não foi possível preparar o cadastro agora. Tente de novo em instantes.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="centralizado">
      <div className="cartao">
        <h1>Segundo fator</h1>
        <p className="apoio">
          Seu perfil enxerga a operação inteira, então o acesso exige um segundo fator. Leia o
          código no aplicativo autenticador e confirme os seis dígitos.
        </p>

        {/* O QR vem como SVG do próprio servidor de Auth; nada externo é carregado. */}
        <div
          className="qr"
          aria-label="Código para leitura no aplicativo autenticador"
          dangerouslySetInnerHTML={{ __html: inscricao.data.totp.qr_code }}
        />

        <details>
          <summary>Não consigo ler o código</summary>
          <p className="apoio codigo-manual">{inscricao.data.totp.secret}</p>
        </details>

        <FormularioCodigo fatorId={inscricao.data.id} />
      </div>
    </main>
  );
}
