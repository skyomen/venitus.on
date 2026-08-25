import { describe, expect, it } from 'vitest';
import { interpretarCredenciais } from './credenciais';

describe('interpretarCredenciais', () => {
  it('aceita e normaliza um par válido', () => {
    expect(interpretarCredenciais('  Consultor@Alfa.local ', 'Venitus@Local123')).toEqual({
      email: 'consultor@alfa.local',
      password: 'Venitus@Local123',
    });
  });

  it('preserva a senha exatamente como digitada', () => {
    // Normalizar senha mudaria a credencial. Só o e-mail é normalizado.
    const credenciais = interpretarCredenciais('a@b.co', '  Senha Com Espaco  ');
    expect(credenciais?.password).toBe('  Senha Com Espaco  ');
  });

  it.each([
    ['tipo errado no e-mail', 42, 'Venitus@Local123'],
    ['tipo errado na senha', 'a@b.co', null],
    ['e-mail vazio', '   ', 'Venitus@Local123'],
    ['e-mail sem arroba', 'semarroba.local', 'Venitus@Local123'],
    ['e-mail sem domínio', 'a@b', 'Venitus@Local123'],
    ['e-mail com espaço', 'a b@c.co', 'Venitus@Local123'],
    ['senha vazia', 'a@b.co', ''],
    ['e-mail longo demais', `${'a'.repeat(200)}@b.co`, 'Venitus@Local123'],
    ['senha longa demais', 'a@b.co', 'x'.repeat(201)],
  ] as const)('recusa %s', (_caso, email, senha) => {
    expect(interpretarCredenciais(email, senha)).toBeNull();
  });
});
