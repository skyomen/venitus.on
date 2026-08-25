import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROTA_MFA_CADASTRAR } from '@/seguranca/mfa';
import { FormularioCodigo } from '../formulario-codigo';
import { sessaoParaMfa } from '../sessao-mfa';

export const metadata: Metadata = { title: 'Confirmar acesso · Venitus.on' };

export default async function Pagina() {
  const { supabase } = await sessaoParaMfa();
  const fatores = await supabase.auth.mfa.listFactors();
  const verificado = fatores.data?.totp.find((f) => f.status === 'verified');

  if (verificado === undefined) {
    redirect(ROTA_MFA_CADASTRAR);
  }

  return (
    <main className="centralizado">
      <div className="cartao">
        <h1>Confirmar acesso</h1>
        <p className="apoio">Informe o código do seu aplicativo autenticador.</p>
        <FormularioCodigo fatorId={verificado.id} />
      </div>
    </main>
  );
}
