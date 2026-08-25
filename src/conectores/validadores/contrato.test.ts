import { describe, expect, it } from 'vitest';
import { obterValidadores } from '../registro';
import type { Validadores } from './contrato';

/**
 * Teste de contrato.
 *
 * Blueprint §21.3: stub e real são validados contra o mesmo acordo — mesmos
 * campos obrigatórios, mesmas recusas, mesma forma de resposta. É isto que
 * garante que trocar um pelo outro não quebra a jornada.
 *
 * Quando o conector real existir, ele entra nesta mesma bateria. A lista abaixo
 * cresce; as asserções não mudam.
 */
const IMPLEMENTACOES: readonly (readonly [string, () => Validadores])[] = [
  ['stub', () => obterValidadores('stub')],
];

describe.each(IMPLEMENTACOES)('validadores: %s', (_nome, criar) => {
  const validadores = criar();

  describe('consultarCpf', () => {
    it('devolve a pessoa quando o CPF é válido', async () => {
      const resultado = await validadores.consultarCpf('529.982.247-25');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor.nome.length).toBeGreaterThan(0);
        expect(resultado.valor.dataNascimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('recusa dígito verificador errado, apontando o campo', async () => {
      const resultado = await validadores.consultarCpf('529.982.247-26');

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.falha.motivo).toBe('PAYLOAD_INVALIDO');
        expect(resultado.falha.campo).toBe('cpf');
      }
    });

    it.each([
      ['10000000108', 'F'],
      ['10000000280', 'M'],
    ])('deriva o sexo do próprio documento (%s)', async (cpf, esperado) => {
      const resultado = await validadores.consultarCpf(cpf);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor.sexo).toBe(esperado);
      }
    });

    it('a mesma consulta devolve sempre a mesma resposta', async () => {
      // Resposta aleatória tornaria o desenvolvimento imprevisível sem tornar o
      // teste mais realista.
      const primeira = await validadores.consultarCpf('529.982.247-25');
      const segunda = await validadores.consultarCpf('529.982.247-25');

      expect(primeira).toEqual(segunda);
    });
  });

  describe('consultarCep', () => {
    it('devolve o endereço quando o CEP é bem formado', async () => {
      const resultado = await validadores.consultarCep('03525000');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor.uf).toHaveLength(2);
      }
    });

    it('recusa CEP fora de oito dígitos', async () => {
      const resultado = await validadores.consultarCep('0352500');

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.falha.campo).toBe('cep');
      }
    });
  });

  describe('consultarPlaca', () => {
    it.each([['ABC1234'], ['BRA1A23']])('aceita o formato %s', async (placa) => {
      const resultado = await validadores.consultarPlaca(placa);

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor.modelos.length).toBeGreaterThan(0);
      }
    });

    it('sabe devolver mais de um modelo', async () => {
      // A desambiguação é caminho real da jornada e precisa ser exercitável.
      const resultado = await validadores.consultarPlaca('ABC1239');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor.modelos.length).toBeGreaterThan(1);
      }
    });

    it('recusa placa fora dos dois formatos', async () => {
      const resultado = await validadores.consultarPlaca('AB123');

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.falha.campo).toBe('placa');
      }
    });
  });

  describe('temWhatsapp', () => {
    it('responde para telefone em E.164', async () => {
      const resultado = await validadores.temWhatsapp('+5511999998888');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(typeof resultado.valor).toBe('boolean');
      }
    });

    it('sabe responder que não há WhatsApp', async () => {
      const resultado = await validadores.temWhatsapp('+5511999998880');

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor).toBe(false);
      }
    });

    it('exige E.164, não um telefone qualquer', async () => {
      const resultado = await validadores.temWhatsapp('11999998888');

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.falha.campo).toBe('telefone');
      }
    });
  });

  it('toda resposta declara a própria origem', async () => {
    // Venda originada de stub não entra em métrica de negócio (§10.5).
    const resultado = await validadores.consultarCpf('529.982.247-25');

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(['REAL', 'STUB']).toContain(resultado.origem);
    }
  });
});

describe('registro', () => {
  it('falha ao pedir implementação que não existe, sem recuar para o stub', () => {
    // Recuo silencioso faria a corretora operar sintética achando que é real.
    expect(() => obterValidadores('real')).toThrow(/não está registrado/);
  });
});
