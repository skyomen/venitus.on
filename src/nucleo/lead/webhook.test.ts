import { describe, expect, it } from 'vitest';
import { assinar, assinaturaConfere, interpretarLead } from './webhook';

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';
const CORPO = '{"canal":"lp-alfa","nome":"Cliente Sintético"}';

describe('assinaturaConfere', () => {
  it('aceita a assinatura correta', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO, SEGREDO), SEGREDO)).toBe(true);
  });

  it('recusa assinatura de outro corpo', () => {
    const deOutroCorpo = assinar('{"canal":"lp-beta"}', SEGREDO);
    expect(assinaturaConfere(CORPO, deOutroCorpo, SEGREDO)).toBe(false);
  });

  it('recusa assinatura feita com outro segredo', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO, 'outro-segredo'), SEGREDO)).toBe(false);
  });

  it('recusa quando o segredo não está configurado', () => {
    // Aceitar sem segredo transformaria um erro de implantação numa porta aberta.
    expect(assinaturaConfere(CORPO, assinar(CORPO, SEGREDO), undefined)).toBe(false);
    expect(assinaturaConfere(CORPO, assinar(CORPO, SEGREDO), '')).toBe(false);
  });

  it.each([[''], [null], [undefined], [42], [{}]])(
    'recusa assinatura ausente ou de outro tipo (%s)',
    (assinatura: unknown) => {
      expect(assinaturaConfere(CORPO, assinatura, SEGREDO)).toBe(false);
    },
  );

  it('recusa assinatura de tamanho diferente sem comparar conteúdo', () => {
    expect(assinaturaConfere(CORPO, 'curta', SEGREDO)).toBe(false);
  });

  it('a mesma entrada assina sempre igual', () => {
    expect(assinar(CORPO, SEGREDO)).toBe(assinar(CORPO, SEGREDO));
  });
});

describe('interpretarLead', () => {
  it('lê canal, nome e o que mais vier', () => {
    expect(
      interpretarLead({
        canal: 'lp-alfa',
        nome: 'Cliente Sintético',
        telefone: '11999998888',
        cpf: '529.982.247-25',
        id_evento: 'evt-1',
      }),
    ).toEqual({
      chaveCanal: 'lp-alfa',
      nome: 'Cliente Sintético',
      telefone: '11999998888',
      cpf: '529.982.247-25',
      idEvento: 'evt-1',
    });
  });

  it('aceita lead só com telefone', () => {
    const lead = interpretarLead({ canal: 'lp-alfa', nome: 'Cliente', telefone: '11999998888' });

    expect(lead?.cpf).toBeNull();
    expect(lead?.idEvento).toBeNull();
  });

  it('ignora a corretora que vier no corpo', () => {
    // O tenant vem do canal, resolvido no banco (§6.8). Aceitá-lo do corpo
    // deixaria qualquer um postar lead na corretora que quisesse.
    const lead = interpretarLead({
      canal: 'lp-alfa',
      nome: 'Cliente',
      corretora_id: '00000000-0000-4000-8000-00000000000b',
    });

    expect(lead).not.toBeNull();
    expect(Object.keys(lead ?? {})).not.toContain('corretora_id');
  });

  it('apara espaço em volta dos campos', () => {
    const lead = interpretarLead({ canal: '  lp-alfa  ', nome: '  Cliente  ' });

    expect(lead?.chaveCanal).toBe('lp-alfa');
    expect(lead?.nome).toBe('Cliente');
  });

  it.each([
    ['sem canal', { nome: 'Cliente' }],
    ['sem nome', { canal: 'lp-alfa' }],
    ['canal vazio', { canal: '   ', nome: 'Cliente' }],
    ['nome vazio', { canal: 'lp-alfa', nome: '' }],
    ['canal de outro tipo', { canal: 7, nome: 'Cliente' }],
  ])('recusa corpo %s', (_caso, corpo) => {
    expect(interpretarLead(corpo)).toBeNull();
  });

  it.each([[null], [undefined], ['texto'], [42], [[]]])(
    'recusa corpo que não é objeto (%s)',
    (corpo: unknown) => {
      expect(interpretarLead(corpo)).toBeNull();
    },
  );
});
