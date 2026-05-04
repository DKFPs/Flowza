import { calculatePoints, generateRewardCode } from '../../../src/services/loyalty';

describe('Loyalty - Unit Tests', () => {
  describe('calculatePoints', () => {
    it('deve calcular 10 pontos para R$100', () => {
      expect(calculatePoints(100)).toBe(10);
    });

    it('deve retornar 0 para valores negativos ou zero', () => {
      expect(calculatePoints(0)).toBe(0);
      expect(calculatePoints(-50)).toBe(0);
    });

    it('deve arredondar para baixo valores quebrados', () => {
      expect(calculatePoints(19.90)).toBe(1);
    });
  });

  describe('generateRewardCode', () => {
    it('deve gerar um código no formato correto', () => {
      const code = generateRewardCode();
      expect(code).toMatch(/^RW-[A-Z0-9]{8}$/);
    });

    it('deve gerar códigos únicos', () => {
      const code1 = generateRewardCode();
      const code2 = generateRewardCode();
      expect(code1).not.toBe(code2);
    });
  });
});
