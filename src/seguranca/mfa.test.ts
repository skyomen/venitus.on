import { describe, expect, it } from 'vitest';
import { PAPEIS } from './autorizacao';
import {
  ROTA_MFA_CADASTRAR,
  ROTA_MFA_VERIFICAR,
  decidirMfa,
  ehRotaMfa,
  mfaObrigatoria,
  papelExigeMfa,
  rotaDaExigencia,
} from './mfa';
import type { EstadoMfa } from './mfa';

function estado(parcial: Partial<EstadoMfa> = {}): EstadoMfa {
  return {
    papel: 'GESTOR',
    obrigatoria: true,
    temFatorVerificado: false,
    nivel: 'aal1',
    ...parcial,
  };
}

describe('papelExigeMfa', () => {
  it('exige de quem enxerga a operação inteira', () => {
    expect(papelExigeMfa('PLATFORM_ADMIN')).toBe(true);
    expect(papelExigeMfa('GESTOR')).toBe(true);
  });

  it('não exige do consultor, que enxerga a própria carteira', () => {
    expect(papelExigeMfa('CONSULTOR')).toBe(false);
  });

  it('cobre todos os papéis conhecidos', () => {
    // Papel novo sem decisão registrada aqui é omissão, não padrão seguro.
    expect(PAPEIS.filter(papelExigeMfa)).toEqual(['PLATFORM_ADMIN', 'GESTOR']);
  });
});

describe('mfaObrigatoria', () => {
  it('vale sempre em produção', () => {
    expect(mfaObrigatoria('production', undefined)).toBe(true);
  });

  it('fica desligada fora de produção', () => {
    expect(mfaObrigatoria('development', undefined)).toBe(false);
    expect(mfaObrigatoria(undefined, undefined)).toBe(false);
  });

  it('a variável força nos dois sentidos', () => {
    expect(mfaObrigatoria('development', 'sim')).toBe(true);
    expect(mfaObrigatoria('production', 'nao')).toBe(false);
  });

  it('valor desconhecido não altera o padrão do ambiente', () => {
    expect(mfaObrigatoria('production', 'talvez')).toBe(true);
    expect(mfaObrigatoria('development', 'talvez')).toBe(false);
  });
});

describe('ehRotaMfa', () => {
  it.each([['/mfa'], [ROTA_MFA_CADASTRAR], [ROTA_MFA_VERIFICAR]])('%s é rota de MFA', (caminho) => {
    expect(ehRotaMfa(caminho)).toBe(true);
  });

  it('prefixo parecido não conta', () => {
    expect(ehRotaMfa('/mfazenda')).toBe(false);
    expect(ehRotaMfa('/app/inicio')).toBe(false);
  });
});

describe('decidirMfa', () => {
  it('manda cadastrar quem precisa e ainda não tem fator', () => {
    expect(decidirMfa(estado({ papel: 'GESTOR' }))).toBe('CADASTRAR');
    expect(decidirMfa(estado({ papel: 'PLATFORM_ADMIN' }))).toBe('CADASTRAR');
  });

  it('não incomoda o consultor sem fator', () => {
    expect(decidirMfa(estado({ papel: 'CONSULTOR' }))).toBe('SEGUIR');
  });

  it('não exige nada quando a obrigatoriedade está desligada', () => {
    expect(decidirMfa(estado({ obrigatoria: false }))).toBe('SEGUIR');
  });

  it('quem cadastrou um fator precisa usá-lo, qualquer que seja o papel', () => {
    // Fator cadastrado e ignorado é pior que nenhum: dá impressão de proteção.
    expect(
      decidirMfa(estado({ papel: 'CONSULTOR', obrigatoria: false, temFatorVerificado: true })),
    ).toBe('VERIFICAR');
  });

  it('segue quando o fator já foi usado nesta sessão', () => {
    expect(decidirMfa(estado({ temFatorVerificado: true, nivel: 'aal2' }))).toBe('SEGUIR');
  });

  it('não manda cadastrar de novo quem já tem fator', () => {
    expect(decidirMfa(estado({ temFatorVerificado: true, nivel: 'aal1' }))).toBe('VERIFICAR');
  });
});

describe('rotaDaExigencia', () => {
  it('leva cada exigência ao seu destino', () => {
    expect(rotaDaExigencia('CADASTRAR')).toBe(ROTA_MFA_CADASTRAR);
    expect(rotaDaExigencia('VERIFICAR')).toBe(ROTA_MFA_VERIFICAR);
  });

  it('seguir não tem destino', () => {
    expect(rotaDaExigencia('SEGUIR')).toBeNull();
  });
});
