/**
 * Isolamento entre corretoras, exercido pela mesma porta que a aplicação usa:
 * PostgREST com um token de verdade, emitido pelo login de verdade.
 *
 * Blueprint §21.1. Este é o teste mais importante do repositório.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORRETORA_ALFA,
  CORRETORA_BETA,
  USUARIOS,
  claimsDe,
  entrar,
  escreverComoUsuario,
  lerComoUsuario,
} from '../apoio/ambiente';

let tokenAlfa: string;
let tokenBeta: string;
let tokenAdmin: string;

beforeAll(async () => {
  [tokenAlfa, tokenBeta, tokenAdmin] = await Promise.all([
    entrar(USUARIOS.consultorAlfa),
    entrar(USUARIOS.consultorBeta),
    entrar(USUARIOS.admin),
  ]);
});

describe('claims do token', () => {
  it('o hook injeta a corretora e o papel', () => {
    const metadados = claimsDe(tokenAlfa)['app_metadata'] as Record<string, unknown>;
    expect(metadados['corretora_id']).toBe(CORRETORA_ALFA);
    expect(metadados['papel']).toBe('CONSULTOR');
  });

  it('o administrador da plataforma não carrega corretora', () => {
    const metadados = claimsDe(tokenAdmin)['app_metadata'] as Record<string, unknown>;
    expect(metadados['corretora_id']).toBeNull();
    expect(metadados['papel']).toBe('PLATFORM_ADMIN');
  });
});

describe('leitura entre tenants', () => {
  it('cada usuário enxerga apenas a própria corretora', async () => {
    const alfa = await lerComoUsuario(tokenAlfa, 'corretora?select=id,nome');
    const beta = await lerComoUsuario(tokenBeta, 'corretora?select=id,nome');

    expect(alfa.linhas.map((l) => l['id'])).toEqual([CORRETORA_ALFA]);
    expect(beta.linhas.map((l) => l['id'])).toEqual([CORRETORA_BETA]);
  });

  it('pedir a corretora do outro tenant pelo id devolve vazio, não erro', async () => {
    // Blueprint §4.1 (V6): não confirmar existência. Sem 403 revelador.
    const resposta = await lerComoUsuario(tokenAlfa, `corretora?id=eq.${CORRETORA_BETA}`);
    expect(resposta.status).toBe(200);
    expect(resposta.linhas).toEqual([]);
  });

  it('usuários de outra corretora não aparecem', async () => {
    const resposta = await lerComoUsuario(tokenAlfa, 'usuario?select=email,corretora_id');
    const corretoras = new Set(resposta.linhas.map((l) => l['corretora_id']));

    expect(resposta.linhas.length).toBeGreaterThan(0);
    expect([...corretoras]).toEqual([CORRETORA_ALFA]);
    expect(resposta.linhas.some((l) => String(l['email']).endsWith('@beta.local'))).toBe(false);
  });

  it('o administrador da plataforma não alcança dado de cliente pelas policies', async () => {
    // D10: nenhuma policy de domínio menciona PLATFORM_ADMIN. Suporte é acesso assistido.
    const corretoras = await lerComoUsuario(tokenAdmin, 'corretora?select=id');
    expect(corretoras.linhas).toEqual([]);
  });

  it('sem token, nada é legível', async () => {
    const resposta = await lerComoUsuario(null, 'corretora?select=id');
    expect(resposta.linhas).toEqual([]);
  });
});

describe('escrita entre tenants', () => {
  const proprio = `usuario?email=eq.${USUARIOS.consultorAlfa}&select=nome,papel,corretora_id`;

  it('o usuário atualiza o próprio nome', async () => {
    const resposta = await escreverComoUsuario(tokenAlfa, proprio, { nome: 'Carla Alfa' });

    expect(resposta.codigo).toBeNull();
    expect(resposta.linhas).toHaveLength(1);
  });

  it('o usuário não consegue se mudar de corretora', async () => {
    // 42501 é o privilégio de coluna negando. RLS não filtra coluna — o recorte
    // é por GRANT, e é ele que este teste precisa exercitar.
    const resposta = await escreverComoUsuario(tokenAlfa, proprio, {
      corretora_id: CORRETORA_BETA,
    });

    expect(resposta.codigo).toBe('42501');

    const depois = await lerComoUsuario(tokenAlfa, 'usuario?select=corretora_id');
    for (const linha of depois.linhas) {
      expect(linha['corretora_id']).toBe(CORRETORA_ALFA);
    }
  });

  it('o usuário não consegue se promover a gestor', async () => {
    const resposta = await escreverComoUsuario(tokenAlfa, proprio, { papel: 'GESTOR' });
    expect(resposta.codigo).toBe('42501');
  });

  it('alterar o usuário de outra corretora não atinge linha alguma', async () => {
    // Aqui o privilégio existe (nome é gravável) e quem barra é a RLS: a policy
    // de update exige id = auth.uid(), então a linha do outro tenant nem é vista.
    const resposta = await escreverComoUsuario(
      tokenAlfa,
      `usuario?email=eq.${USUARIOS.consultorBeta}&select=nome`,
      { nome: 'invadido' },
    );

    expect(resposta.codigo).toBeNull();
    expect(resposta.linhas).toEqual([]);

    const beta = await lerComoUsuario(
      tokenBeta,
      `usuario?email=eq.${USUARIOS.consultorBeta}&select=nome`,
    );
    expect(beta.linhas[0]?.['nome']).toBe('Bruno Beta');
  });

  it('o cadastro da corretora não é gravável por usuário comum', async () => {
    const resposta = await escreverComoUsuario(
      tokenAlfa,
      `corretora?id=eq.${CORRETORA_ALFA}&select=nome`,
      { nome: 'renomeada' },
    );
    expect(resposta.codigo).toBe('42501');
  });
});

describe('catálogo da plataforma', () => {
  it('é legível por qualquer autenticado, das duas corretoras', async () => {
    const alfa = await lerComoUsuario(tokenAlfa, 'produto?select=codigo');
    const beta = await lerComoUsuario(tokenBeta, 'produto?select=codigo');

    expect(alfa.linhas.length).toBeGreaterThan(0);
    expect(alfa.linhas).toEqual(beta.linhas);
  });

  it('não é gravável por usuário comum', async () => {
    const resposta = await escreverComoUsuario(tokenAlfa, 'produto?codigo=eq.AUTO&select=codigo', {
      nome: 'alterado',
    });
    expect(resposta.codigo).toBe('42501');
  });
});
