import { describe, expect, it } from 'vitest';
import { interpretarPerfil } from './perfil';

const CORRETORA = '00000000-0000-4000-8000-00000000000a';

describe('interpretarPerfil', () => {
  it('traduz um consultor com corretora', () => {
    expect(
      interpretarPerfil({
        sub: 'u1',
        email: 'consultor@alfa.local',
        app_metadata: { papel: 'CONSULTOR', corretora_id: CORRETORA },
      }),
    ).toEqual({
      usuarioId: 'u1',
      email: 'consultor@alfa.local',
      papel: 'CONSULTOR',
      corretoraId: CORRETORA,
    });
  });

  it('aceita o administrador da plataforma sem corretora', () => {
    // D10: corretora nula é o estado correto dele, não um erro de leitura.
    expect(
      interpretarPerfil({
        sub: 'u2',
        email: 'admin@venitus.local',
        app_metadata: { papel: 'PLATFORM_ADMIN', corretora_id: null },
      }),
    ).toEqual({
      usuarioId: 'u2',
      email: 'admin@venitus.local',
      papel: 'PLATFORM_ADMIN',
      corretoraId: null,
    });
  });

  it.each([[null], [undefined]])('devolve nulo quando não há claims (%s)', (claims: unknown) => {
    expect(interpretarPerfil(claims as null)).toBeNull();
  });

  it('recusa o app_metadata do objeto de usuário, que não carrega os claims do hook', () => {
    // Este é exatamente o formato devolvido por getUser(): sem `papel`.
    // Aceitá-lo silenciosamente seria conceder acesso sem papel definido.
    expect(
      interpretarPerfil({
        sub: 'u3',
        email: 'a@b.co',
        app_metadata: { provider: 'email', providers: ['email'] },
      }),
    ).toBeNull();
  });

  it.each([
    ['sem app_metadata', { sub: 'u3' }],
    ['app_metadata nulo', { sub: 'u3', app_metadata: null }],
    ['app_metadata não objeto', { sub: 'u3', app_metadata: 'CONSULTOR' }],
    ['sem papel', { sub: 'u3', app_metadata: { corretora_id: CORRETORA } }],
    ['papel desconhecido', { sub: 'u3', app_metadata: { papel: 'GERENTE' } }],
    ['papel não textual', { sub: 'u3', app_metadata: { papel: 7 } }],
    ['sem sub', { app_metadata: { papel: 'GESTOR' } }],
    ['sub vazio', { sub: '', app_metadata: { papel: 'GESTOR' } }],
    ['sub não textual', { sub: 9, app_metadata: { papel: 'GESTOR' } }],
  ])('recusa perfil %s, sem acesso parcial', (_caso, claims) => {
    expect(interpretarPerfil(claims)).toBeNull();
  });

  it('trata e-mail ausente como vazio, sem derrubar a sessão', () => {
    const perfil = interpretarPerfil({ sub: 'u4', app_metadata: { papel: 'PLATFORM_ADMIN' } });
    expect(perfil?.email).toBe('');
  });

  it.each([[''], [42], [null], [undefined]])(
    'normaliza corretora inválida (%s) para nulo',
    (corretora: unknown) => {
      const perfil = interpretarPerfil({
        sub: 'u5',
        email: 'a@b.co',
        app_metadata: { papel: 'GESTOR', corretora_id: corretora },
      });
      expect(perfil?.corretoraId).toBeNull();
    },
  );
});
