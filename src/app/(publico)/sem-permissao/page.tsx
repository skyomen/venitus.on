import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sem permissão · Venitus.on' };

export default function Pagina() {
  return (
    <main className="centralizado">
      <div className="cartao">
        <h1>Sem permissão</h1>
        <p className="apoio">Esta área não pertence ao seu perfil.</p>
        <Link href="/entrar">Voltar ao início</Link>
      </div>
    </main>
  );
}
