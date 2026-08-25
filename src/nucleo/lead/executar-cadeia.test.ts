import { describe, expect, it } from 'vitest';
import { obterValidadores } from '@/conectores/registro';
import { falha, sucesso } from '@/conectores/contrato';
import type { Validadores } from '@/conectores/validadores/contrato';
import { executarCadeia } from './executar-cadeia';
import type { DadosDoLead } from './cadeia';

const validadores = obterValidadores('stub');

// Dados sintéticos (AGENTS.md, invariante 10).
const COMPLETO: DadosDoLead = {
  telefone: '11999998888',
  cpf: '529.982.247-25',
  cep: '03525-000',
  placa: 'BRA1A23',
};

describe('caminho completo', () => {
  it('o lead com tudo válido chega a QUALIFICADO', async () => {
    const resultado = await executarCadeia(COMPLETO, validadores);

    expect(resultado.decisao).toEqual({ tipo: 'QUALIFICADO' });
    expect(resultado.etapa).toBe('QUALIFICADO');
    expect(resultado.contatavel).toBe(true);
  });

  it('traz o enriquecimento dos validadores', async () => {
    const resultado = await executarCadeia(COMPLETO, validadores);

    expect(resultado.enriquecimento.nome).toBeDefined();
    expect(resultado.enriquecimento.uf).toHaveLength(2);
    expect(resultado.enriquecimento.modelos).toHaveLength(1);
  });
});

describe('caminhos que param', () => {
  it('sem CPF, para e pede só o CPF', async () => {
    const resultado = await executarCadeia({ ...COMPLETO, cpf: undefined }, validadores);

    expect(resultado.decisao).toEqual({ tipo: 'PEDIR_DADO', passo: 'CPF', campo: 'cpf' });
    expect(resultado.etapa).toBe('AGUARDANDO_DADO');
  });

  it('telefone sem WhatsApp segue por e-mail e marca não contatável', async () => {
    // No stub, telefone terminado em 0 não tem WhatsApp.
    const resultado = await executarCadeia({ ...COMPLETO, telefone: '11999998880' }, validadores);

    expect(resultado.decisao).toEqual({ tipo: 'SEGUIR_POR_EMAIL' });
    expect(resultado.contatavel).toBe(false);
  });

  it('placa com dois modelos devolve a escolha ao cliente', async () => {
    // No stub, placa terminada em 9 devolve dois modelos.
    const resultado = await executarCadeia({ ...COMPLETO, placa: 'ABC1239' }, validadores);

    expect(resultado.decisao).toEqual({ tipo: 'DESAMBIGUAR_MODELO' });
    expect(resultado.enriquecimento.modelos).toHaveLength(2);
  });
});

describe('conector que falha', () => {
  function comFalhaNoWhatsapp(): Validadores {
    return {
      ...validadores,
      async temWhatsapp() {
        return falha('INDISPONIVEL', 'o fornecedor não respondeu');
      },
    };
  }

  it('interrompe a cadeia sem inventar resposta', async () => {
    const resultado = await executarCadeia(COMPLETO, comFalhaNoWhatsapp());

    // Seguir presumindo que há WhatsApp mandaria mensagem para quem não recebe.
    expect(resultado.decisao).toEqual({
      tipo: 'CONSULTAR',
      passo: 'TELEFONE',
      valor: '+5511999998888',
    });
    expect(resultado.etapa).toBe('EM_VALIDACAO');
    expect(resultado.falha?.motivo).toBe('INDISPONIVEL');
  });

  it('não insiste no conector que acabou de falhar', async () => {
    let chamadas = 0;
    const contando: Validadores = {
      ...validadores,
      async temWhatsapp() {
        chamadas += 1;
        return falha('INDISPONIVEL', 'fora do ar');
      },
    };

    await executarCadeia(COMPLETO, contando);

    expect(chamadas).toBe(1);
  });

  it.each([
    ['de CPF', 'consultarCpf' as const, 'nome' as const],
    ['de CEP', 'consultarCep' as const, 'uf' as const],
  ])('enriquecimento %s que falha não derruba a decisão', async (_caso, metodo, campo) => {
    // O enriquecimento é um bônus: a jornada segue sem ele.
    const semEnriquecimento: Validadores = {
      ...validadores,
      async [metodo]() {
        return falha('INDISPONIVEL', 'fora do ar');
      },
    };

    const resultado = await executarCadeia(COMPLETO, semEnriquecimento);

    expect(resultado.decisao).toEqual({ tipo: 'QUALIFICADO' });
    expect(resultado.enriquecimento[campo]).toBeUndefined();
  });

  it('não consulta enriquecimento de dado que o lead nem trouxe', async () => {
    let consultasDeCep = 0;
    const contando: Validadores = {
      ...validadores,
      async consultarCep(cep: string) {
        consultasDeCep += 1;
        return validadores.consultarCep(cep);
      },
    };

    await executarCadeia({ ...COMPLETO, cep: undefined }, contando);

    expect(consultasDeCep).toBe(0);
  });
});

describe('consulta de placa que falha', () => {
  it('interrompe a cadeia e guarda o motivo', async () => {
    const semPlaca: Validadores = {
      ...validadores,
      async consultarPlaca() {
        return falha('INDISPONIVEL', 'a base de placas não respondeu');
      },
    };

    const resultado = await executarCadeia(COMPLETO, semPlaca);

    expect(resultado.decisao).toEqual({ tipo: 'CONSULTAR', passo: 'PLACA', valor: 'BRA1A23' });
    expect(resultado.falha?.motivo).toBe('INDISPONIVEL');
  });
});

describe('conector inconsistente', () => {
  it('não gira para sempre quando a resposta nunca fecha', async () => {
    // Um conector que responde sem nunca satisfazer a cadeia travaria o worker.
    const inconsistente: Validadores = {
      ...validadores,
      async temWhatsapp() {
        return sucesso(true, 'STUB');
      },
      async consultarPlaca() {
        return sucesso({ modelos: [] }, 'STUB');
      },
    };

    const resultado = await executarCadeia(COMPLETO, inconsistente);

    expect(resultado.decisao).toEqual({ tipo: 'PEDIR_DADO', passo: 'PLACA', campo: 'placa' });
  });
});
