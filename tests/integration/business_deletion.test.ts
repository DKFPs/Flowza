import { describe, it, expect, beforeEach } from '@jest/globals';

interface Profile {
  uid: string;
  email: string;
  business_id: string | null;
  onboarding_completed: boolean;
}

interface Business {
  id: string;
  name: string;
  owner_id: string;
}

interface Professional {
  id: string;
  business_id: string;
  name: string;
}

interface Service {
  id: string;
  business_id: string;
  name: string;
}

interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  professional_id: string;
}

class TenantDBEmulator {
  public profiles = new Map<string, Profile>();
  public businesses = new Map<string, Business>();
  public professionals = new Map<string, Professional>();
  public services = new Map<string, Service>();
  public appointments = new Map<string, Appointment>();
  public auditLogs: any[] = [];

  public clear() {
    this.profiles.clear();
    this.businesses.clear();
    this.professionals.clear();
    this.services.clear();
    this.appointments.clear();
    this.auditLogs = [];
  }

  // Simulate server-side POST /api/businesses/delete transacional
  public async deleteBusinessEndpoint(uid: string, businessId: string) {
    const biz = this.businesses.get(businessId);
    if (!biz) {
      throw new Error("Negócio não encontrado.");
    }
    if (biz.owner_id !== uid) {
      throw new Error("Não autorizado.");
    }

    const businessName = biz.name;
    let recordsRemovedCount = 0;

    // Remove sub-collection records
    for (const [key, value] of Array.from(this.professionals.entries())) {
      if (value.business_id === businessId) {
        this.professionals.delete(key);
        recordsRemovedCount++;
      }
    }

    for (const [key, value] of Array.from(this.services.entries())) {
      if (value.business_id === businessId) {
        this.services.delete(key);
        recordsRemovedCount++;
      }
    }

    for (const [key, value] of Array.from(this.appointments.entries())) {
      if (value.business_id === businessId) {
        this.appointments.delete(key);
        recordsRemovedCount++;
      }
    }

    // Remove business itself
    this.businesses.delete(businessId);
    recordsRemovedCount++;

    // Reset user profile to allow immediate onboarding of a new business
    const userProfile = this.profiles.get(uid);
    if (userProfile) {
      userProfile.business_id = null;
      userProfile.onboarding_completed = false;
    }

    // Log the action for security audit
    this.auditLogs.push({
      action: "business_deleted",
      user_id: uid,
      business_id: "deleted_system",
      details: {
        deleted_business_id: businessId,
        deleted_business_name: businessName,
        total_records_removed: recordsRemovedCount,
        removed_by_user_id: uid
      },
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: `Negócio "${businessName}" excluído com sucesso.`,
      recordsRemoved: recordsRemovedCount
    };
  }
}

describe('Flowza - Backend Business Deletion & User Account Preservation Tests', () => {
  const db = new TenantDBEmulator();

  beforeEach(() => {
    db.clear();

    // Setup initial platform tenants
    // Tenant 1 (The target)
    db.profiles.set('user_1', {
      uid: 'user_1',
      email: 'owner_1@flowza.com',
      business_id: 'biz_1',
      onboarding_completed: true
    });
    db.businesses.set('biz_1', { id: 'biz_1', name: 'Barbearia Vintage', owner_id: 'user_1' });
    db.professionals.set('pro_1', { id: 'pro_1', business_id: 'biz_1', name: 'Carlos Barbeiro' });
    db.services.set('srv_1', { id: 'srv_1', business_id: 'biz_1', name: 'Corte de Cabelo' });
    db.appointments.set('apt_1', { id: 'apt_1', business_id: 'biz_1', client_id: 'client_1', professional_id: 'pro_1' });

    // Tenant 2 (Other Tenant to check multi-tenant safety and non-leakage)
    db.profiles.set('user_2', {
      uid: 'user_2',
      email: 'owner_2@flowza.com',
      business_id: 'biz_2',
      onboarding_completed: true
    });
    db.businesses.set('biz_2', { id: 'biz_2', name: 'Salão Glamour', owner_id: 'user_2' });
    db.professionals.set('pro_2', { id: 'pro_2', business_id: 'biz_2', name: 'Helena Hair' });
    db.services.set('srv_2', { id: 'srv_2', business_id: 'biz_2', name: 'Escova Progressiva' });
    db.appointments.set('apt_2', { id: 'apt_2', business_id: 'biz_2', client_id: 'client_2', professional_id: 'pro_2' });
  });

  it('deve realizar exclusão segura do negócio através do endpoint do backend, preservando o usuário e seu perfil', async () => {
    const res = await db.deleteBusinessEndpoint('user_1', 'biz_1');
    expect(res.success).toBe(true);
    expect(res.recordsRemoved).toBeGreaterThan(0);

    // 1. Validar que o negócio "biz_1" foi removido
    expect(db.businesses.has('biz_1')).toBe(false);

    // 2. Validar que o usuário "user_1" continua autenticado e seu perfil no banco foi preservado (não deletado)
    expect(db.profiles.has('user_1')).toBe(true);

    // 3. Validar que os estados do perfil de "user_1" foram resetados para permitir criação imediata de outro negócio
    const profile = db.profiles.get('user_1')!;
    expect(profile.business_id).toBeNull();
    expect(profile.onboarding_completed).toBe(false);

    // 4. Validar que todos os recursos associados ao "biz_1" foram excluídos do Firestore
    const remainingPros = Array.from(db.professionals.values()).filter(p => p.business_id === 'biz_1');
    const remainingSrvs = Array.from(db.services.values()).filter(s => s.business_id === 'biz_1');
    const remainingApts = Array.from(db.appointments.values()).filter(a => a.business_id === 'biz_1');

    expect(remainingPros.length).toBe(0);
    expect(remainingSrvs.length).toBe(0);
    expect(remainingApts.length).toBe(0);
  });

  it('deve garantir que nenhum dado de outros tenants é afetado durante o processo de exclusão', async () => {
    await db.deleteBusinessEndpoint('user_1', 'biz_1');

    // Tenant 2 continua intocado, sem perda de referências
    expect(db.businesses.has('biz_2')).toBe(true);
    expect(db.profiles.get('user_2')!.business_id).toBe('biz_2');
    expect(db.profiles.get('user_2')!.onboarding_completed).toBe(true);

    const pro2 = Array.from(db.professionals.values()).filter(p => p.business_id === 'biz_2');
    const srv2 = Array.from(db.services.values()).filter(s => s.business_id === 'biz_2');
    const apt2 = Array.from(db.appointments.values()).filter(a => a.business_id === 'biz_2');

    expect(pro2.length).toBe(1);
    expect(srv2.length).toBe(1);
    expect(apt2.length).toBe(1);
  });

  it('deve simular criação imediata de um novo negócio pelo mesmo usuário após a exclusão', async () => {
    // 1. Excluir o negócio atual
    await db.deleteBusinessEndpoint('user_1', 'biz_1');

    // 2. Simular o fluxo de Onboarding Wizard recriando o negócio
    const newBizId = 'biz_new_1';
    db.businesses.set(newBizId, { id: newBizId, name: 'Nova Barbearia Moderna', owner_id: 'user_1' });
    
    // Atualizar o perfil do usuário
    const profile = db.profiles.get('user_1')!;
    profile.business_id = newBizId;
    profile.onboarding_completed = true;

    // Criar recursos para o novo negócio
    db.professionals.set('pro_new', { id: 'pro_new', business_id: newBizId, name: 'Roberto Master' });
    db.services.set('srv_new', { id: 'srv_new', business_id: newBizId, name: 'Corte e Barba Premium' });

    // Verificar se o novo negócio e seus novos recursos estão associados perfeitamente
    expect(db.businesses.get(newBizId)!.name).toBe('Nova Barbearia Moderna');
    expect(db.profiles.get('user_1')!.business_id).toBe(newBizId);
    expect(db.profiles.get('user_1')!.onboarding_completed).toBe(true);
    expect(db.professionals.get('pro_new')!.business_id).toBe(newBizId);
    expect(db.services.get('srv_new')!.business_id).toBe(newBizId);
  });

  it('deve registrar log de auditoria completo para o administrador global com detalhes detalhados', async () => {
    await db.deleteBusinessEndpoint('user_1', 'biz_1');

    expect(db.auditLogs.length).toBe(1);
    const log = db.auditLogs[0];
    expect(log.action).toBe('business_deleted');
    expect(log.user_id).toBe('user_1');
    expect(log.details.deleted_business_name).toBe('Barbearia Vintage');
    expect(log.details.total_records_removed).toBeGreaterThan(0);
  });
});
