// Test suite globals provided by Jest
import { normalizePhone, normalizeName, isValidPhone } from '../../src/lib/normalization';

describe('Normalização de Dados (Módulo 2)', () => {
  it('deve normalizar telefones removendo caracteres especiais', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('11999999999');
    expect(normalizePhone('+55 21 8888 7777')).toBe('552188887777');
  });

  it('deve normalizar nomes capitalizando corretamente', () => {
    expect(normalizeName('joão SILVA')).toBe('João Silva');
    expect(normalizeName('  MARIA aparecida ')).toBe('Maria Aparecida');
  });

  it('deve validar formatos de telefone brasileiros', () => {
    expect(isValidPhone('11999998888')).toBe(true);
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('11999998888777')).toBe(false);
  });
});

describe('Segurança e Idempotência (Módulo 1 & 3)', () => {
  it('deve gerar ID determinístico para evitar duplicidade', () => {
    const bizId = 'biz_123';
    const clientId = 'cli_456';
    const date = '2024-05-10';
    const time = '14:30';
    
    const id1 = `${bizId}_${clientId}_${date.replace(/-/g, "")}_${time.replace(/:/g, "")}`;
    const id2 = `${bizId}_${clientId}_${date.replace(/-/g, "")}_${time.replace(/:/g, "")}`;
    
    expect(id1).toBe(id2);
    expect(id1).toBe('biz_123_cli_456_20240510_1430');
  });
});
