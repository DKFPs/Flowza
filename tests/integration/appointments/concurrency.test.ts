// Test suite globals provided by Jest

// Simulating the transactional booking function from BookingPage
// For a deterministic ID like what we did in the code
function generateSlotId(bizId: string, profId: string, dateStr: string, timeStr: string) {
  return `${bizId}_${profId}_${dateStr.replace(/-/g, "")}_${timeStr.replace(/:/g, "")}`;
}

// Simulador de banco de dados e Transactions
class MockFirestore {
  data: Record<string, any> = {};

  async runTransaction(callback: (t: any) => Promise<any>) {
    // In real Firestore, this holds a lock on the accessed docs.
    // We simulate this atomic behavior by running synchronously in memory.
    const transaction = {
      get: async (ref: string) => {
        return {
          exists: () => !!this.data[ref],
          data: () => this.data[ref]
        };
      },
      set: (ref: string, payload: any) => {
        this.data[ref] = payload;
      },
      update: (ref: string, payload: any) => {
        if (this.data[ref]) {
          this.data[ref] = { ...this.data[ref], ...payload };
        }
      }
    };
    return await callback(transaction);
  }
}

describe('Módulo 7 - Concurrency & Idempotency Tests', () => {
  let db: MockFirestore;

  beforeEach(() => {
    db = new MockFirestore();
    db.data['business/demo'] = { id: 'demo', usage_appointments: 0 };
  });

  const simulateBookingAttempt = async (clientId: string, professionalId: string, time: string) => {
    const slotId = generateSlotId('demo', professionalId, '2026-05-15', time);
    
    return db.runTransaction(async (t) => {
      const aptSnap = await t.get(`appointments/${slotId}`);
      
      if (aptSnap.exists()) {
        const data = aptSnap.data();
        if (data.status !== 'cancelled') {
          // Idempotency Check (Módulo 5)
          if (data.client_id === clientId) {
            return { aptId: slotId, alreadyExists: true, success: true };
          }
          throw new Error("Este horário acabou de ser ocupado.");
        }
      }

      t.set(`appointments/${slotId}`, {
        client_id: clientId,
        professional_id: professionalId,
        status: 'confirmed'
      });
      
      // Módulo 3 - Adiciona à Fila
      t.set(`notification_queue/notif_${slotId}`, {
        status: 'pending',
        appointment_id: slotId
      });

      return { aptId: slotId, success: true };
    });
  };

  it('deve simular múltiplos usuários tentando o mesmo agendamento simultaneamente (Race Condition)', async () => {
    // Attempt simultaneous requests
    const p1 = simulateBookingAttempt('client1', 'prof1', '14:00');
    const p2 = simulateBookingAttempt('client2', 'prof1', '14:00');
    const p3 = simulateBookingAttempt('client3', 'prof1', '14:00');

    // Módulo 1 - O primeiro ganha, os outros falham
    const results = await Promise.allSettled([p1, p2, p3]);
    
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Apenas UM deve ter sucesso
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(2);
    
    // Validar se gerou 1 agendamento e 1 notificação apenas
    const slotId = generateSlotId('demo', 'prof1', '2026-05-15', '14:00');
    expect(db.data[`appointments/${slotId}`]).toBeDefined();
    expect(db.data[`appointments/${slotId}`].status).toBe('confirmed');
    expect(db.data[`notification_queue/notif_${slotId}`]).toBeDefined();
  });

  it('deve lidar com request duplicado do mesmo usuário (Idempotência / Falhas de rede)', async () => {
    // Simula User 1 clicando em agendar duas vezes (ex. internet falha na volta)
    const res1 = await simulateBookingAttempt('client1', 'prof1', '14:00');
    expect(res1.success).toBe(true);

    const res2 = await simulateBookingAttempt('client1', 'prof1', '14:00');
    
    // Módulo 5 - Idempotência Global garante sucesso silencioso na 2a vez pra não quebrar a UI
    expect(res2.success).toBe(true);
    expect(res2.alreadyExists).toBe(true);

    // O slot pertence a client1
    const slotId = generateSlotId('demo', 'prof1', '2026-05-15', '14:00');
    expect(db.data[`appointments/${slotId}`].client_id).toBe('client1');
  });
});
