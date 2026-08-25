import { describe, expect, it } from 'vitest';
import {
  TEMAS,
  atributoDoTema,
  descricaoDoSeletor,
  ehTema,
  interpretarTema,
  proximoTema,
  rotuloDoTema,
} from './tema';

describe('ehTema', () => {
  it.each(TEMAS)('reconhece %s', (tema) => {
    expect(ehTema(tema)).toBe(true);
  });

  it.each([['dark'], ['light'], [''], [null], [undefined], [3]])('recusa %s', (valor: unknown) => {
    expect(ehTema(valor)).toBe(false);
  });
});

describe('interpretarTema', () => {
  it('mantém uma escolha conhecida', () => {
    expect(interpretarTema('claro')).toBe('claro');
    expect(interpretarTema('escuro')).toBe('escuro');
  });

  it.each([[undefined], [''], ['inventado'], [7]])(
    'volta para sistema quando o valor é %s',
    (valor: unknown) => {
      // `sistema` nunca está errado: ele acompanha o aparelho.
      expect(interpretarTema(valor)).toBe('sistema');
    },
  );
});

describe('atributoDoTema', () => {
  it('não marca o documento no tema do sistema', () => {
    // É a ausência do atributo que deixa a consulta de mídia decidir.
    expect(atributoDoTema('sistema')).toBeUndefined();
  });

  it('marca o documento na escolha explícita', () => {
    expect(atributoDoTema('claro')).toBe('claro');
    expect(atributoDoTema('escuro')).toBe('escuro');
  });
});

describe('proximoTema', () => {
  it('percorre o ciclo de três e volta ao começo', () => {
    expect(proximoTema('sistema')).toBe('claro');
    expect(proximoTema('claro')).toBe('escuro');
    expect(proximoTema('escuro')).toBe('sistema');
  });

  it('sempre volta a passar por sistema', () => {
    // Com um interruptor de dois estados, quem alternasse uma vez nunca mais
    // voltaria a acompanhar o aparelho.
    let tema = proximoTema('sistema');
    const visitados = [tema];
    for (let i = 0; i < TEMAS.length; i += 1) {
      tema = proximoTema(tema);
      visitados.push(tema);
    }
    expect(visitados).toContain('sistema');
  });

  it('o ciclo cobre todos os temas conhecidos', () => {
    const visitados = new Set<string>();
    let tema: (typeof TEMAS)[number] = 'sistema';
    for (let i = 0; i < TEMAS.length; i += 1) {
      visitados.add(tema);
      tema = proximoTema(tema);
    }
    expect(visitados.size).toBe(TEMAS.length);
  });
});

describe('rotuloDoTema', () => {
  it.each(TEMAS)('%s tem rótulo legível', (tema) => {
    expect(rotuloDoTema(tema)).toMatch(/Sistema|Claro|Escuro/);
  });
});

describe('descricaoDoSeletor', () => {
  it('anuncia onde está e para onde vai', () => {
    expect(descricaoDoSeletor('claro')).toBe('Claro. Alternar para escuro.');
    expect(descricaoDoSeletor('escuro')).toBe('Escuro. Alternar para sistema.');
    expect(descricaoDoSeletor('sistema')).toBe('Sistema. Alternar para claro.');
  });
});
