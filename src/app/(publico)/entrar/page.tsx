import type { Metadata } from 'next';
import { FormularioLogin } from './formulario';

export const metadata: Metadata = { title: 'Entrar · Venitus.on' };

export default function Pagina() {
  return (
    <main className="centralizado">
      <div className="cartao">
        <h1>Venitus.on</h1>
        <p className="apoio">Operação comercial de seguros pronta para usar.</p>
        <FormularioLogin />
      </div>
    </main>
  );
}
