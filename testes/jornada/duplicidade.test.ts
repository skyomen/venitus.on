/**
 * Contato não duplica; oportunidade pode repetir (blueprint §8.4).
 *
 * Esta regra substitui a da operação atual, que marca "Duplicidade" e perde a
 * oportunidade quando houve contato nos últimos 15 dias. Aqui o histórico do
 * contato é preservado e uma intenção nova vira negócio novo.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { CORRETORA_ALFA, CORRETORA_BETA, consultar, encerrarConexao } from '../apoio/ambiente';

interface Contato extends Record<string, unknown> {
  id: string;
  nome: string;
  cpf: string | null;
  telefone_e164: string | null;
}

let contador = 0;

/**
 * Semente por execução.
 *
 * Sem ela os identificadores se repetiam entre rodadas e os testes encontravam
 * o contato criado na execução anterior — passando ou falhando por causa de
 * estado antigo, não do comportamento em teste.
 */
const SEMENTE = Math.floor(Math.random() * 1_000_000);

/** CPF sintético e único por execução. Nunca dado real (AGENTS.md, invariante 10). */
function documento(): string {
  contador += 1;
  return String(90_000_000_000 + SEMENTE * 1_000 + contador);
}

function telefone(): string {
  contador += 1;
  return `+5511${String(900_000_000 + SEMENTE * 100 + contador)}`;
}

async function localizarOuCriar(
  corretora: string,
  nome: string,
  cpf: string | null,
  fone: string | null,
): Promise<Contato> {
  const [linha] = await consultar<Contato>(
    'select * from public.localizar_ou_criar_contato($1, $2, $3, $4)',
    [corretora, nome, cpf, fone],
  );
  if (linha === undefined) {
    throw new Error('função não devolveu contato');
  }
  return linha;
}

afterAll(encerrarConexao);

describe('contato', () => {
  it('cria na primeira vez e reencontra na segunda, pelo CPF', async () => {
    const cpf = documento();

    const primeiro = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Um', cpf, null);
    const segundo = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Um', cpf, null);

    expect(segundo.id).toBe(primeiro.id);
  });

  it('reencontra pelo telefone quando não há CPF', async () => {
    const fone = telefone();

    const primeiro = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Dois', null, fone);
    const segundo = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Dois', null, fone);

    expect(segundo.id).toBe(primeiro.id);
  });

  it('completa o dado que faltava sem sobrescrever o que já existia', async () => {
    // Um toque novo costuma trazer o que faltava, não corrigir o que havia.
    const fone = telefone();
    const cpf = documento();

    const primeiro = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Três', null, fone);
    expect(primeiro.cpf).toBeNull();

    const segundo = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Três', cpf, fone);

    expect(segundo.id).toBe(primeiro.id);
    expect(segundo.cpf).toBe(cpf);
    expect(segundo.telefone_e164).toBe(fone);
  });

  it('a mesma pessoa em duas corretoras são dois contatos', async () => {
    // Os tenants não se enxergam; unificar seria vazamento, não economia.
    const cpf = documento();

    const naAlfa = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Quatro', cpf, null);
    const naBeta = await localizarOuCriar(CORRETORA_BETA, 'Cliente Quatro', cpf, null);

    expect(naBeta.id).not.toBe(naAlfa.id);
  });

  it('recusa unir dois cadastros que descrevem a mesma pessoa', async () => {
    // Um contato tem só o telefone, outro só o CPF, e agora chega um toque com os
    // dois. Completar em silêncio escolheria um dos cadastros e perderia o outro;
    // unir é decisão de negócio, e o chamador encaminha para quarentena.
    const fone = telefone();
    const cpf = documento();

    await localizarOuCriar(CORRETORA_ALFA, 'Só Telefone', null, fone);
    await localizarOuCriar(CORRETORA_ALFA, 'Só CPF', cpf, null);

    await expect(localizarOuCriar(CORRETORA_ALFA, 'Os Dois', cpf, fone)).rejects.toThrow(
      /conflito de identidade/,
    );
  });

  it('recusa contato sem nenhum identificador', async () => {
    await expect(localizarOuCriar(CORRETORA_ALFA, 'Sem Identidade', null, null)).rejects.toThrow(
      /CPF ou telefone/,
    );
  });
});

describe('oportunidade', () => {
  async function abrir(contatoId: string, produto: string | null): Promise<string> {
    const [linha] = await consultar<{ id: string }>(
      `select id from public.abrir_oportunidade($1, $2, $3, 'LANDING_PAGE')`,
      [CORRETORA_ALFA, contatoId, produto],
    );
    return linha?.id ?? '';
  }

  async function produtoAuto(): Promise<string> {
    const [linha] = await consultar<{ id: string }>(
      `select id from public.produto where codigo = 'AUTO'`,
    );
    return linha?.id ?? '';
  }

  it('a mesma intenção ativa atualiza em vez de duplicar', async () => {
    const contato = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Cinco', documento(), null);
    const produto = await produtoAuto();

    const primeira = await abrir(contato.id, produto);
    const segunda = await abrir(contato.id, produto);

    expect(segunda).toBe(primeira);
  });

  it('o toque repetido fica registrado na linha do tempo', async () => {
    const contato = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Seis', documento(), null);
    const produto = await produtoAuto();

    const oportunidade = await abrir(contato.id, produto);
    await abrir(contato.id, produto);

    const eventos = await consultar(
      `select tipo from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'TOQUE_REPETIDO'`,
      [oportunidade],
    );
    expect(eventos).toHaveLength(1);
  });

  it('uma intenção nova vira oportunidade nova no mesmo contato', async () => {
    const contato = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Sete', documento(), null);

    const auto = await abrir(contato.id, await produtoAuto());
    const outra = await abrir(contato.id, null);

    expect(outra).not.toBe(auto);
  });

  it('depois de encerrada, um novo toque abre oportunidade nova', async () => {
    // É aqui que a regra antiga perdia o negócio: contato recente virava
    // "duplicidade" e a oportunidade morria.
    const contato = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Oito', documento(), null);
    const produto = await produtoAuto();

    const primeira = await abrir(contato.id, produto);
    await consultar(`select public.mover_oportunidade($1, 'PERDIDA', 'TESTE', 'desistiu')`, [
      primeira,
    ]);

    const segunda = await abrir(contato.id, produto);

    expect(segunda).not.toBe(primeira);
  });

  it('cada abertura cria a qualificação e registra o evento', async () => {
    const contato = await localizarOuCriar(CORRETORA_ALFA, 'Cliente Nove', documento(), null);
    const oportunidade = await abrir(contato.id, await produtoAuto());

    const qualificacao = await consultar<{ contatabilidade: string; completude: string }>(
      'select contatabilidade, completude from public.qualificacao where oportunidade_id = $1',
      [oportunidade],
    );
    expect(qualificacao[0]?.completude).toBe('PENDENTE');

    const abertura = await consultar(
      `select tipo from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'ABERTURA'`,
      [oportunidade],
    );
    expect(abertura).toHaveLength(1);
  });
});
