import { describe, expect, it } from 'vitest';
import {
  PAPEIS,
  ROTA_LOGIN,
  ROTA_SEM_PERMISSAO,
  areaDe,
  decidirRota,
  ehPapel,
  ehRotaProtegida,
  ehRotaPublica,
  podeAcessar,
  rotaInicialDe,
} from './autorizacao';

describe('ehPapel', () => {
  it.each(PAPEIS)('reconhece %s', (papel) => {
    expect(ehPapel(papel)).toBe(true);
  });

  it.each([['GERENTE'], [''], [null], [undefined], [42], [{}]])('recusa %s', (valor: unknown) => {
    expect(ehPapel(valor)).toBe(false);
  });
});

describe('áreas', () => {
  it('cada papel tem a própria área', () => {
    expect(areaDe('PLATFORM_ADMIN')).toBe('/admin');
    expect(areaDe('GESTOR')).toBe('/gestor');
    expect(areaDe('CONSULTOR')).toBe('/app');
  });

  it('as áreas não se sobrepõem', () => {
    const areas = PAPEIS.map(areaDe);
    expect(new Set(areas).size).toBe(areas.length);
  });

  it('o login manda cada papel para a própria home', () => {
    expect(rotaInicialDe('PLATFORM_ADMIN')).toBe('/admin/inicio');
    expect(rotaInicialDe('GESTOR')).toBe('/gestor/inicio');
    expect(rotaInicialDe('CONSULTOR')).toBe('/app/inicio');
  });
});

describe('classificação de rota', () => {
  it.each([ROTA_LOGIN, ROTA_SEM_PERMISSAO, '/entrar/recuperar'])('%s é pública', (caminho) => {
    expect(ehRotaPublica(caminho)).toBe(true);
    expect(ehRotaProtegida(caminho)).toBe(false);
  });

  it.each(['/admin', '/admin/inicio', '/gestor/funil', '/app/fila'])(
    '%s é protegida',
    (caminho) => {
      expect(ehRotaProtegida(caminho)).toBe(true);
      expect(ehRotaPublica(caminho)).toBe(false);
    },
  );

  it('rota fora das áreas conhecidas não é protegida nem pública', () => {
    expect(ehRotaProtegida('/')).toBe(false);
    expect(ehRotaPublica('/')).toBe(false);
  });

  it('prefixo parecido não conta como a área', () => {
    // `/aplicativo` não pode cair na área `/app`.
    expect(ehRotaProtegida('/aplicativo')).toBe(false);
    expect(podeAcessar('CONSULTOR', '/aplicativo')).toBe(false);
  });
});

describe('podeAcessar', () => {
  it('o consultor alcança a própria área', () => {
    expect(podeAcessar('CONSULTOR', '/app')).toBe(true);
    expect(podeAcessar('CONSULTOR', '/app/fila')).toBe(true);
  });

  it.each([
    ['CONSULTOR', '/admin/inicio'],
    ['CONSULTOR', '/gestor/inicio'],
    ['GESTOR', '/app/inicio'],
    ['GESTOR', '/admin/inicio'],
    ['PLATFORM_ADMIN', '/app/inicio'],
    ['PLATFORM_ADMIN', '/gestor/inicio'],
  ] as const)('%s não alcança %s', (papel, caminho) => {
    expect(podeAcessar(papel, caminho)).toBe(false);
  });
});

describe('decidirRota', () => {
  it('rota protegida sem papel vai para o login', () => {
    expect(decidirRota(null, '/app/inicio')).toEqual({
      tipo: 'redirecionar',
      destino: ROTA_LOGIN,
    });
  });

  it('papel fora da própria área vai para sem-permissão, não para a área alheia', () => {
    // Redirecionar para a área do outro confirmaria que ela existe.
    expect(decidirRota('CONSULTOR', '/admin/inicio')).toEqual({
      tipo: 'redirecionar',
      destino: ROTA_SEM_PERMISSAO,
    });
  });

  it('papel na própria área segue', () => {
    expect(decidirRota('CONSULTOR', '/app/fila')).toEqual({ tipo: 'seguir' });
  });

  it('quem já entrou não fica preso na tela de login', () => {
    expect(decidirRota('GESTOR', ROTA_LOGIN)).toEqual({
      tipo: 'redirecionar',
      destino: '/gestor/inicio',
    });
  });

  it('quem não entrou vê a tela de login', () => {
    expect(decidirRota(null, ROTA_LOGIN)).toEqual({ tipo: 'seguir' });
  });

  it('sem-permissão é alcançável com e sem papel', () => {
    expect(decidirRota(null, ROTA_SEM_PERMISSAO)).toEqual({ tipo: 'seguir' });
    expect(decidirRota('CONSULTOR', ROTA_SEM_PERMISSAO)).toEqual({ tipo: 'seguir' });
  });

  it('rota fora das áreas segue, com ou sem papel', () => {
    expect(decidirRota(null, '/')).toEqual({ tipo: 'seguir' });
    expect(decidirRota('GESTOR', '/')).toEqual({ tipo: 'seguir' });
  });
});
