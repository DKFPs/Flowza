
import { hasOverlappingSlots } from '../../../src/services/scheduling';

// Mock do banco de dados (simulando estado acumulado)
const dbMock = {
  appointments: [
    { id: '1', start: '10:00', end: '11:00', professionalId: 'P1' }
  ]
};

async function createAppointmentIntegration(newAppointment: any) {
  // Simula a verificação de conflito que aconteceria no servidor/banco
  const professionalAppointments = dbMock.appointments.filter(a => a.professionalId === newAppointment.professionalId);
  
  if (hasOverlappingSlots(newAppointment, professionalAppointments)) {
    throw new Error('Horário indisponível');
  }
  
  dbMock.appointments.push(newAppointment);
  return { success: true, appointment: newAppointment };
}

describe('Integration - Appointments & Concurrency', () => {
  beforeEach(() => {
    dbMock.appointments = [{ id: '1', start: '10:00', end: '11:00', professionalId: 'P1' }];
  });

  it('deve associar cliente ao profissional e criar agendamento no banco fictício', async () => {
    const result = await createAppointmentIntegration({
      id: '2',
      start: '11:00',
      end: '12:00',
      professionalId: 'P1',
      clientId: 'C1'
    });
    
    expect(result.success).toBe(true);
    expect(dbMock.appointments.length).toBe(2);
  });

  it('deve falhar se dois usuários tentarem agendar o mesmo horário (Concorrência)', async () => {
    const appointmentAttempt = {
      id: '3',
      start: '10:30', // Conflita com o ID 1 (10:00 - 11:00)
      end: '11:30',
      professionalId: 'P1'
    };

    await expect(createAppointmentIntegration(appointmentAttempt)).rejects.toThrow('Horário indisponível');
  });
});
