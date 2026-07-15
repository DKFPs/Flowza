import { AppRole, Business, Service, Appointment } from "@shared/types";

export interface DashboardInsights {
  score: {
    value: number;
    rating: 'Ruim' | 'Regular' | 'Bom' | 'Excelente';
    color: string;
  };
  revenueLost: number;
  revenueOpportunity: number;
  forecast: {
    next7DaysAppts: number;
    next7DaysRevenue: number;
    trend: 'growing' | 'declining' | 'stable';
  };
  retention: {
    rate: number;
    text: string;
    newClients: number;
    recurring: number;
    vip: number;
    lost: number;
  };
  insights: {
    id: string;
    type: 'critical' | 'important' | 'opportunity';
    message: string;
    actionText: string;
  }[];
  comparisons: {
    appointmentsGrowth: number;
    revenueGrowth: number;
  };
}

export const AnalyticsIntelligenceService = {
  generateInsights: (appointments: Record<string, unknown>[], services: Record<string, unknown>[], currentBusiness: Record<string, unknown>): DashboardInsights => {
    const now = new Date();
    
    // Split appointments into periods
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    
    const previous7Days = new Date(last7Days);
    previous7Days.setDate(previous7Days.getDate() - 7);
    
    const currentWeekAppts = appointments.filter(a => new Date(a.appointment_date as string) >= last7Days && new Date(a.appointment_date as string) <= now);
    const prevWeekAppts = appointments.filter(a => new Date(a.appointment_date as string) >= previous7Days && new Date(a.appointment_date as string) < last7Days);

    const appointmentsGrowth = prevWeekAppts.length ? ((currentWeekAppts.length - prevWeekAppts.length) / prevWeekAppts.length) * 100 : 0;
    
    // Revenue lost from no-shows and cancellations
    const noShows = appointments.filter(a => a.status === 'no_show');
    const cancelled = appointments.filter(a => a.status === 'cancelled');
    
    const calculateValue = (appts: Record<string, unknown>[]) => appts.reduce((acc, a) => {
      const s = services.find(srv => srv.id === a.service_id);
      return acc + ((s?.price as number) || 0);
    }, 0);
    
    const revenueLost = calculateValue(noShows) + calculateValue(cancelled);
    const revenueOpportunity = calculateValue(cancelled);

    // Retention
    const clientCounts: Record<string, number> = {};
    const clientLastVisit: Record<string, Date> = {};
    
    appointments.forEach(a => {
      if (!a.client_id) return;
      clientCounts[a.client_id] = (clientCounts[a.client_id] || 0) + 1;
      
      const apptDate = new Date(a.appointment_date);
      if (!clientLastVisit[a.client_id] || apptDate > clientLastVisit[a.client_id]) {
         clientLastVisit[a.client_id] = apptDate;
      }
    });

    let newClients = 0;
    let recurring = 0;
    let vip = 0;
    let lost = 0;

    const totalClients = Object.keys(clientCounts).length;
    
    Object.entries(clientCounts).forEach(([clientId, count]) => {
      if (count === 1) newClients++;
      if (count > 1 && count < 5) recurring++;
      if (count >= 5) vip++;
      
      const daysSinceLastVisit = (now.getTime() - clientLastVisit[clientId].getTime()) / (1000 * 3600 * 24);
      if (daysSinceLastVisit > 60) lost++;
    });

    const retentionRate = totalClients > 0 ? ((recurring + vip) / totalClients) * 100 : 0;
    const rateOutOf10 = Math.round((retentionRate / 100) * 10);
    const retentionText = totalClients > 0 ? `Apenas ${rateOutOf10} em cada 10 clientes voltam` : "Ainda sem dados de retenção";

    // Forecast (Simple Moving Average)
    const next7DaysAppts = Math.round(currentWeekAppts.length * 1.05); // Simple projection
    const avgPrice = services.length > 0 ? services.reduce((acc, s) => acc + s.price, 0) / services.length : 50;
    const next7DaysRevenue = next7DaysAppts * avgPrice;

    // Insights Generation
    const insights: DashboardInsights['insights'] = [];
    
    if (noShows.length > 0) {
      insights.push({
        id: 'high_noshow',
        type: 'critical',
        message: `Você perdeu R$${calculateValue(noShows).toFixed(2)} em faltas recentes.`,
        actionText: 'Ativar Lembretes Automáticos'
      });
    }
    
    if (lost > 0) {
      insights.push({
        id: 'lost_clients',
        type: 'important',
        message: `${lost} clientes não agendam há mais de 60 dias.`,
        actionText: 'Criar Promoção de Reativação'
      });
    }

    if (appointmentsGrowth < 0) {
      insights.push({
        id: 'growth_drop',
        type: 'critical',
        message: `Queda de ${Math.abs(Math.round(appointmentsGrowth))}% nos agendamentos (semana vs semana).`,
        actionText: 'Investigar Causa'
      });
    } else if (appointmentsGrowth > 10) {
        insights.push({
          id: 'growth_good',
          type: 'opportunity',
          message: `Agendamentos subiram ${Math.round(appointmentsGrowth)}%. Ótimo momento para tentar upsell.`,
          actionText: 'Aumentar Ticket Médio'
        });
    }

    // Business Score
    let scoreVal = 50;
    if (retentionRate > 50) scoreVal += 15;
    if (appointmentsGrowth > 0) scoreVal += 15;
    if (noShows.length === 0) scoreVal += 10;
    if (vip > 0) scoreVal += 10;
    
    scoreVal = Math.min(Math.max(scoreVal, 0), 100);
    let rating: DashboardInsights['score']['rating'] = 'Regular';
    let color = 'text-yellow-500';
    
    if (scoreVal >= 80) { rating = 'Excelente'; color = 'text-green-500'; }
    else if (scoreVal >= 60) { rating = 'Bom'; color = 'text-blue-500'; }
    else if (scoreVal < 40) { rating = 'Ruim'; color = 'text-red-500'; }

    return {
      score: { value: scoreVal, rating, color },
      revenueLost,
      revenueOpportunity,
      forecast: {
        next7DaysAppts,
        next7DaysRevenue,
        trend: appointmentsGrowth >= 0 ? 'growing' : 'declining'
      },
      retention: {
        rate: retentionRate,
        text: retentionText,
        newClients,
        recurring,
        vip,
        lost
      },
      insights,
      comparisons: {
        appointmentsGrowth,
        revenueGrowth: appointmentsGrowth // simplified for now
      }
    };
  }
};
