
import { 
  isOverlapping, 
  shouldBlacklist,
  generateRecurringSeries 
} from '../../../src/core/businessRules';

describe('Unit Tests - Appointments Domain', () => {
  describe('Scheduling Conflicts', () => {
    it('deve detectar sobreposição de horários', () => {
      const slot1 = { start: new Date('2024-01-01T10:00:00'), end: new Date('2024-01-01T11:00:00') };
      const slot2 = { start: new Date('2024-01-01T10:30:00'), end: new Date('2024-01-01T11:30:00') };
      expect(isOverlapping(slot1, slot2)).toBe(true);
    });
  });

  describe('Blacklist Rules', () => {
    it('deve sinalizar blacklist após 3 cancelamentos', () => {
      expect(shouldBlacklist(3)).toBe(true);
      expect(shouldBlacklist(2)).toBe(false);
    });
  });

  describe('Recurrence', () => {
    it('deve gerar uma série semanal de 4 agendamentos', () => {
      const start = new Date('2024-05-01T10:00:00');
      const end = new Date('2024-05-01T11:00:00');
      const slots = generateRecurringSeries(start, end, 4);
      
      expect(slots).toHaveLength(4);
      expect(slots[1].start.getDate()).toBe(8);
    });
  });
});
