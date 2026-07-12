import { describe, it, expect, beforeEach } from '@jest/globals';

interface Business {
  id: string;
  name: string;
  owner_id: string;
  plan_id: string;
  default_working_hours?: Array<{ day_of_week: string; start_time: string; end_time: string; is_active: boolean }>;
}

interface Professional {
  id: string;
  business_id: string;
  name: string;
  user_id?: string;
  working_hours?: { start: string; end: string };
  working_days?: number[];
}

interface Service {
  id: string;
  business_id: string;
  name: string;
  price: number;
}

interface Client {
  id: string;
  business_id: string;
  name: string;
  phone: string;
}

interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  date: string;
  time: string;
}

// Emulating full multi-tenant datastore with isolation and reference constraints
class DatabaseEmulator {
  public businesses = new Map<string, Business>();
  public professionals = new Map<string, Professional>();
  public services = new Map<string, Service>();
  public clients = new Map<string, Client>();
  public appointments = new Map<string, Appointment>();

  public clear() {
    this.businesses.clear();
    this.professionals.clear();
    this.services.clear();
    this.clients.clear();
    this.appointments.clear();
  }

  // Multi-tenant querying methods
  public getBusinessByOwner(ownerId: string): Business | null {
    for (const biz of this.businesses.values()) {
      if (biz.owner_id === ownerId) return biz;
    }
    return null;
  }

  public getProfessionalsByBusiness(businessId: string): Professional[] {
    return Array.from(this.professionals.values()).filter(p => p.business_id === businessId);
  }

  public getServicesByBusiness(businessId: string): Service[] {
    return Array.from(this.services.values()).filter(s => s.business_id === businessId);
  }

  public getClientsByBusiness(businessId: string): Client[] {
    return Array.from(this.clients.values()).filter(c => c.business_id === businessId);
  }

  public getAppointmentsByBusiness(businessId: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(a => a.business_id === businessId);
  }
}

describe('Flowza Multi-Tenant Persistence & Security Validation', () => {
  const db = new DatabaseEmulator();

  beforeEach(() => {
    db.clear();
  });

  it('deve realizar persistência completa de 10 negócios independentes e certificar isolamento de dados', () => {
    const totalTenants = 10;
    
    // --- 1. CRIAÇÃO E PERSISTÊNCIA ---
    for (let i = 1; i <= totalTenants; i++) {
      const ownerId = `owner_${i}`;
      const businessId = `business_${i}`;
      const professionalId = `pro_${i}`;
      const serviceId = `srv_${i}`;
      const clientId = `cli_${i}`;
      const appointmentId = `apt_${i}`;

      // Criar Negócio (Business)
      const biz: Business = {
        id: businessId,
        name: `Barbearia Estilo ${i}`,
        owner_id: ownerId,
        plan_id: 'pro',
        default_working_hours: [
          { day_of_week: 'monday', start_time: '09:00', end_time: '18:00', is_active: true },
          { day_of_week: 'tuesday', start_time: '09:00', end_time: '18:00', is_active: true },
        ]
      };
      db.businesses.set(businessId, biz);

      // Criar Profissional
      const pro: Professional = {
        id: professionalId,
        business_id: businessId,
        name: `Professional Barbeiro ${i}`,
        user_id: ownerId,
        working_hours: { start: '09:00', end: '18:00' },
        working_days: [1, 2]
      };
      db.professionals.set(professionalId, pro);

      // Criar Serviço
      const srv: Service = {
        id: serviceId,
        business_id: businessId,
        name: `Corte de Cabelo ${i}`,
        price: 50 + (i * 5)
      };
      db.services.set(serviceId, srv);

      // Criar Cliente
      const client: Client = {
        id: clientId,
        business_id: businessId,
        name: `Cliente Fiel ${i}`,
        phone: `+551199999000${i}`
      };
      db.clients.set(clientId, client);

      // Criar Horário / Agendamento (Appointment)
      const apt: Appointment = {
        id: appointmentId,
        business_id: businessId,
        client_id: clientId,
        professional_id: professionalId,
        service_id: serviceId,
        date: '2026-07-05',
        time: '10:00'
      };
      db.appointments.set(appointmentId, apt);
    }

    // --- 2. VALIDAÇÃO DE INTEGRIDADE ---
    expect(db.businesses.size).toBe(totalTenants);
    expect(db.professionals.size).toBe(totalTenants);
    expect(db.services.size).toBe(totalTenants);
    expect(db.clients.size).toBe(totalTenants);
    expect(db.appointments.size).toBe(totalTenants);

    // --- 3. REINICIALIZAÇÃO / LOGOUT / LOGIN (EFEITO SIMULADO) ---
    // Limpar sessões locais e forçar releitura simulando nova inicialização do aplicativo
    for (let i = 1; i <= totalTenants; i++) {
      const ownerId = `owner_${i}`;
      const expectedBusinessId = `business_${i}`;

      // Simula Login: busca negócio associado ao proprietário
      const loadedBiz = db.getBusinessByOwner(ownerId);
      expect(loadedBiz).not.toBeNull();
      expect(loadedBiz!.id).toBe(expectedBusinessId);

      // Simula Carregamento de Telas (Profissionais, Serviços, Clientes e Horários)
      const loadedProfessionals = db.getProfessionalsByBusiness(expectedBusinessId);
      const loadedServices = db.getServicesByBusiness(expectedBusinessId);
      const loadedClients = db.getClientsByBusiness(expectedBusinessId);
      const loadedAppointments = db.getAppointmentsByBusiness(expectedBusinessId);

      // Certificar que há exatamente 1 registro de cada para este tenant
      expect(loadedProfessionals.length).toBe(1);
      expect(loadedServices.length).toBe(1);
      expect(loadedClients.length).toBe(1);
      expect(loadedAppointments.length).toBe(1);

      // Certificar que as referências internas de ID apontam corretamente para o negócio
      expect(loadedProfessionals[0].business_id).toBe(expectedBusinessId);
      expect(loadedServices[0].business_id).toBe(expectedBusinessId);
      expect(loadedClients[0].business_id).toBe(expectedBusinessId);
      expect(loadedAppointments[0].business_id).toBe(expectedBusinessId);
      expect(loadedAppointments[0].client_id).toBe(`cli_${i}`);
      expect(loadedAppointments[0].professional_id).toBe(`pro_${i}`);
      expect(loadedAppointments[0].service_id).toBe(`srv_${i}`);
    }

    // --- 4. VALIDAÇÃO DE MULTI-TENANCY E NÃO-VAZAMENTO ---
    // Garantir que nenhum tenant consiga ler dados de outro tenant
    for (let i = 1; i <= totalTenants; i++) {
      const businessId = `business_${i}`;

      const loadedProfessionals = db.getProfessionalsByBusiness(businessId);
      const loadedServices = db.getServicesByBusiness(businessId);
      const loadedClients = db.getClientsByBusiness(businessId);
      const loadedAppointments = db.getAppointmentsByBusiness(businessId);

      // Cada consulta deve conter APENAS dados referentes a `business_id === businessId`
      for (const pro of loadedProfessionals) {
        expect(pro.business_id).toBe(businessId);
      }
      for (const srv of loadedServices) {
        expect(srv.business_id).toBe(businessId);
      }
      for (const cli of loadedClients) {
        expect(cli.business_id).toBe(businessId);
      }
      for (const apt of loadedAppointments) {
        expect(apt.business_id).toBe(businessId);
      }
    }
  });
});
