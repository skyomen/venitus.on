/**
 * Entrada de lead e resolução de tenant (blueprint §6.8).
 *
 * É o canal que diz de quem é o lead. Canal desconhecido vai para quarentena e
 * nunca vira oportunidade por adivinhação — se o tenant viesse de um campo do
 * corpo, qualquer um postaria lead na corretora que quisesse.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { CORRETORA_ALFA, CORRETORA_BETA, consultar, encerrarConexao } from '../apoio/ambiente';

interface Oportunidade extends Record<string, unknown> {
  id: string | null;
  corretora_id: string;
  origem: string;
  etapa: string;
  canal_captacao_id: string | null;
}

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

/** Telefone sintético e único por execução (AGENTS.md, invariante 10). */
function telefone(): string {
  contador += 1;
  return `+5511${String(900_000_000 + SEMENTE * 100 + contador)}`;
}

async function receber(
  chave: string,
  nome: string,
  fone: string | null,
  cpf: string | null = null,
): Promise<Oportunidade | null> {
  const [linha] = await consultar<Oportunidade>(
    `select * from public.receber_lead($1, $2, $3, $4, '{"origem":"teste"}'::jsonb)`,
    [chave, nome, fone, cpf],
  );
  return linha?.id === null ? null : (linha ?? null);
}

afterAll(encerrarConexao);

describe('resolução do tenant', () => {
  it('o canal decide a corretora dona do lead', async () => {
    const naAlfa = await receber('lp-alfa', 'Cliente Alfa', telefone());
    const naBeta = await receber('lp-beta', 'Cliente Beta', telefone());

    expect(naAlfa?.corretora_id).toBe(CORRETORA_ALFA);
    expect(naBeta?.corretora_id).toBe(CORRETORA_BETA);
  });

  it('a oportunidade guarda por qual canal entrou', async () => {
    const oportunidade = await receber('lp-alfa', 'Cliente Rastreável', telefone());
    expect(oportunidade?.canal_captacao_id).not.toBeNull();
  });

  it('a origem vem do canal, não do corpo da requisição', async () => {
    // O corpo diz `"origem":"teste"`; quem manda é o canal cadastrado.
    const oportunidade = await receber('lp-alfa', 'Cliente Origem', telefone());
    expect(oportunidade?.origem).toBe('LANDING_PAGE');
  });

  it('a oportunidade nasce em NOVO, antes de qualquer validação', async () => {
    const oportunidade = await receber('lp-alfa', 'Cliente Novo', telefone());
    expect(oportunidade?.etapa).toBe('NOVO');
  });
});

describe('quarentena', () => {
  it('canal desconhecido não vira oportunidade', async () => {
    const oportunidade = await receber('canal-que-ninguem-cadastrou', 'Sem Dono', telefone());
    expect(oportunidade).toBeNull();
  });

  it('o lead sem dono fica guardado inteiro, para ser retomado', async () => {
    const chave = `desconhecido-${SEMENTE}`;
    await receber(chave, 'Sem Dono', telefone());

    const [quarentena] = await consultar<{ motivo: string; corpo_cru: Record<string, unknown> }>(
      'select motivo, corpo_cru from public.lead_quarentena where chave_identificacao = $1',
      [chave],
    );

    expect(quarentena?.motivo).toBe('CANAL_NAO_RECONHECIDO');
    expect(quarentena?.corpo_cru).toEqual({ origem: 'teste' });
  });

  it('canal desativado é tratado como desconhecido', async () => {
    await consultar(
      `update public.canal_captacao set ativo = false where chave_identificacao = 'lp-beta'`,
    );
    const oportunidade = await receber('lp-beta', 'Canal Desligado', telefone());
    await consultar(
      `update public.canal_captacao set ativo = true where chave_identificacao = 'lp-beta'`,
    );

    expect(oportunidade).toBeNull();
  });

  it('conflito de identidade vai para quarentena em vez de derrubar a entrada', async () => {
    // Dois cadastros descrevendo a mesma pessoa: unir é decisão de negócio.
    const fone = telefone();
    const cpf = String(90_000_000_000 + SEMENTE * 10 + contador);

    await receber('lp-alfa', 'Só Telefone', fone);
    await receber('lp-alfa', 'Só CPF', null, cpf);

    const oportunidade = await receber('lp-alfa', 'Os Dois', fone, cpf);

    expect(oportunidade).toBeNull();

    const [quarentena] = await consultar<{ motivo: string }>(
      `select motivo from public.lead_quarentena
       where motivo = 'CONFLITO_DE_IDENTIDADE' order by criado_em desc limit 1`,
    );
    expect(quarentena?.motivo).toBe('CONFLITO_DE_IDENTIDADE');
  });
});

describe('toque repetido', () => {
  it('o mesmo cliente pelo mesmo canal não abre oportunidade nova', async () => {
    const fone = telefone();

    const primeira = await receber('lp-alfa', 'Cliente Insistente', fone);
    const segunda = await receber('lp-alfa', 'Cliente Insistente', fone);

    expect(segunda?.id).toBe(primeira?.id);
  });
});
