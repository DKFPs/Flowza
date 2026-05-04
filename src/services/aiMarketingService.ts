
import { Appointment, Client, Service, AICampaignResult, Business } from '@/types';
import { format, subDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { AISchedulingService } from './aiSchedulingService';

export interface PlaybookAction {
  clientId: string;
  clientName: string;
  type: 'rescue' | 'flash_fill' | 'loyalty' | 'upsell';
  message: string;
  context: string;
  priority: 'low' | 'medium' | 'high';
}

export class AIMarketingService {
  /**
   * analyzes business data and suggests specific marketing actions (Playbooks)
   */
  static analyzeOpportunities(
    appointments: Appointment[],
    clients: Client[],
    services: Service[],
    business: Business
  ): PlaybookAction[] {
    const actions: PlaybookAction[] = [];
    const now = new Date();

    // 1. PLAYBOOK: RESCUE (Churn prevention)
    const inactiveClientIds = AISchedulingService.getClientsToReengage(appointments, 30);
    inactiveClientIds.forEach(clientId => {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        actions.push({
          clientId,
          clientName: client.name,
          type: 'rescue',
          priority: 'high',
          context: 'Sem agendamentos há mais de 30 dias.',
          message: this.generateCopy('rescue', client.name, business.name)
        });
      }
    });

    // 2. PLAYBOOK: FLASH FILL (Idle slots for tomorrow)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = format(tomorrow, 'yyyy-MM-dd');
    
    const tomorrowApts = appointments.filter(a => a.appointment_date === tomorrowDateStr);
    if (tomorrowApts.length < 3) { // Arbitrary "idle" threshold
      // Target active clients who like top services
      const topProductIds = this.getTopServices(appointments);
      const topService = services.find(s => s.id === topProductIds[0]);
      
      const potentialClients = clients.slice(0, 5); // Simple selection for demo
      potentialClients.forEach(client => {
         if (!inactiveClientIds.includes(client.id)) {
            actions.push({
              clientId: client.id,
              clientName: client.name,
              type: 'flash_fill',
              priority: 'medium',
              context: 'Agenda de amanhã com baixa ocupação.',
              message: this.generateCopy('flash_fill', client.name, business.name, topService?.name)
            });
         }
      });
    }

    // 3. PLAYBOOK: SMART UPSELL
    // Identify clients who always do one service and suggest another
    const frequentClients = this.getFrequentClients(appointments);
    frequentClients.slice(0, 3).forEach(item => {
      const client = clients.find(c => c.id === item.clientId);
      const lastApt = appointments.find(a => a.client_id === item.clientId);
      const currentService = services.find(s => s.id === lastApt?.service_id);
      const otherService = services.find(s => s.id !== currentService?.id && s.is_active);

      if (client && otherService) {
        actions.push({
          clientId: client.id,
          clientName: client.name,
          type: 'upsell',
          priority: 'low',
          context: `Cliente fiel de ${currentService?.name}. Sugerir ${otherService.name}.`,
          message: this.generateCopy('upsell', client.name, business.name, otherService.name)
        });
      }
    });

    return actions;
  }

  private static generateCopy(type: string, clientName: string, businessName: string, extra?: string): string {
    const firstName = clientName.split(' ')[0];
    
    switch(type) {
      case 'rescue':
        return `Olá ${firstName}! Notamos que faz um tempo que você não nos visita na ${businessName}. Ficamos com saudade! Que tal renovar seu visual esta semana? Responda 'QUERO' para ver os horários VIP que reservei para você.`;
      case 'flash_fill':
        return `Oi ${firstName}! Tenho uma oportunidade exclusiva na ${businessName}. Surgiram 2 vagas para amanhã para o serviço ${extra || 'que você adora'}. Se agendar agora, te dou um bônus surpresa. Topa?`;
      case 'upsell':
        return `Olá ${firstName}! Como você é um cliente especial da ${businessName}, que tal experimentar nosso novo serviço de ${extra}? Ele complementa perfeitamente o que você já faz conosco. Posso te mandar os detalhes?`;
      case 'loyalty':
        return `Parabéns ${firstName}! Você acaba de atingir 500 pontos na ${businessName}! 🌟 Isso vale um desconto especial no seu próximo agendamento. Vamos marcar?`;
      default:
        return `Olá ${firstName}, como podemos ajudar você hoje na ${businessName}?`;
    }
  }

  private static getTopServices(appointments: Appointment[]): string[] {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      counts[a.service_id] = (counts[a.service_id] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  }

  private static getFrequentClients(appointments: Appointment[]): { clientId: string, count: number }[] {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      if (a.client_id) counts[a.client_id] = (counts[a.client_id] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([clientId, count]) => ({ clientId, count }));
  }
}
