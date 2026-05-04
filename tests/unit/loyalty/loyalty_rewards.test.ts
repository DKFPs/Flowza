
import { 
  calculateServicePoints, 
  generateRewardCode 
} from '../../../src/core/businessRules';

describe('Unit Tests - Loyalty Domain', () => {
  describe('calculateServicePoints', () => {
    it('deve calcular pontos corretamente baseados no preço (R$150 = 150 pts)', () => {
      expect(calculateServicePoints(150.50)).toBe(150);
    });

    it('deve retornar 0 para valores negativos', () => {
      expect(calculateServicePoints(-10)).toBe(0);
    });
  });

  describe('generateRewardCode', () => {
    it('deve gerar código de recompensa no formato NOM-1234', () => {
      const code = generateRewardCode('Italo');
      expect(code).toMatch(/^[A-Z]{3}-\d{4}$/);
    });
  });
});
