import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decidirRota } from '@/seguranca/autorizacao';
import { interpretarPerfil } from '@/seguranca/perfil';

/**
 * Renova a sessão e decide o roteamento.
 *
 * Convenção `proxy` do Next 16, que substituiu `middleware`.
 *
 * Blueprint §4.1 (V13): isto é conveniência, não segurança. Quem barra de verdade
 * é o layout de cada área (`exigirAcesso`) e a RLS. Se este arquivo sumisse, o
 * acesso continuaria negado — só ficaria mais feio.
 */

const OPCOES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export async function proxy(requisicao: NextRequest) {
  let resposta = NextResponse.next({ request: requisicao });

  const supabase = createServerClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return requisicao.cookies.getAll();
        },
        setAll(aDefinir) {
          for (const { name, value } of aDefinir) {
            requisicao.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request: requisicao });
          for (const { name, value, options } of aDefinir) {
            resposta.cookies.set(name, value, { ...options, ...OPCOES_COOKIE });
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const perfil = interpretarPerfil(data?.claims);

  const decisao = decidirRota(perfil?.papel ?? null, requisicao.nextUrl.pathname);

  if (decisao.tipo === 'redirecionar') {
    const destino = requisicao.nextUrl.clone();
    destino.pathname = decisao.destino;
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|webp)$).*)'],
};
