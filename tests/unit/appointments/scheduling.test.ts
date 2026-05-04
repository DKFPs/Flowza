
import { isValidTimeSlot, hasOverlappingSlots } from '../../../src/services/scheduling';

describe('Scheduling - Unit Tests', () => {
  describe('isValidTimeSlot', () => {
    it('deve aceitar um horário válido (mínimo 15 min)', () => {
      expect(isValidTimeSlot({ start: '09:00', end: '09:15' })).toBe(true);
    });

    it('deve rejeitar se o término for antes do início', () => {
      expect(isValidTimeSlot({ start: '10:00', end: '09:00' })).toBe(false);
    });

    it('deve rejeitar horários com menos de 15 minutos', () => {
      expect(isValidTimeSlot({ start: '09:00', end: '09:10' })).toBe(false);
    });

    it('deve rejeitar valores mal formatados', () => {
      expect(isValidTimeSlot({ start: 'abc', end: '10:00' })).toBe(false);
    });
  });

  describe('hasOverlappingSlots', () => {
    const existing = [
      { start: '09:00', end: '10:00' },
      { start: '14:00', end: '15:00' }
    ];

    it('deve detectar conflito total', () => {
      expect(hasOverlappingSlots({ start: '09:15', end: '09:45' }, existing)).toBe(true);
    });

    it('deve detectar conflito parcial (início dentro)', () => {
      expect(hasOverlappingSlots({ start: '09:45', end: '10:15' }, existing)).toBe(true);
    });

    it('deve aceitar horário livre', () => {
      expect(hasOverlappingSlots({ start: '10:00', end: '11:00' }, existing)).toBe(false);
      expect(hasOverlappingSlots({ start: '13:00', end: '14:00' }, existing)).toBe(false);
    });
  });
});
