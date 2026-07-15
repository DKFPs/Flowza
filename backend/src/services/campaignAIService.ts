import { collection, addDoc, serverTimestamp, updateDoc, doc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SmartCampaign {
  id?: string;
  business_id: string;
  type: 'reactivation' | 'loyalty_boost' | 'welcome' | 'vip_exclusive' | 'new_service';
  name: string;
  message_template: string;
  is_active: boolean;
  target_segment: string;
  reward_id?: string;
  anti_spam_days: number;
  performance: {
    sent: number;
    opened: number;
    converted: number;
    revenue_generated: number;
  };
  created_at?: unknown;
}

export const CampaignAIService = {
  // Gera campanhas sugeridas baseado no estado atual
  generateSuggestions: (stats: Record<string, unknown>, businessName: string): Partial<SmartCampaign>[] => {
    const suggestions: Partial<SmartCampaign>[] = [];

    // Se tiver clientes inativos
    if ((stats?.totalClients as number) > 0 && ((stats?.recurringClients as number) / (stats?.totalClients as number)) < 0.5) {
      suggestions.push({
         type: 'reactivation',
         name: 'Reativar Clientes Inativos',
         target_segment: 'inactive',
         message_template: `Oi {{firstName}}! Faz um tempinho que não te vemos no ${businessName} 👀\n\nLiberamos um bônus especial para o seu próximo agendamento. Que tal marcar um horário?`,
         anti_spam_days: 30,
         is_active: false
      });
    }

    // Se tiver clientes com pouca frequência (potencial loyalty)
    suggestions.push({
      type: 'loyalty_boost',
      name: 'Incentivo de Retorno',
      target_segment: 'single_visit',
      message_template: `Ei {{firstName}}! Gostou do seu último atendimento? Reagende essa semana e ganhe pontos em dobro no nosso programa de fidelidade! ⭐️`,
      anti_spam_days: 15,
      is_active: false
    });

    // Se tiver clientes VIP (frequência alta)
    suggestions.push({
       type: 'vip_exclusive',
       name: 'Oferta VIP',
       target_segment: 'vip',
       message_template: `Olá {{firstName}}! Como você é um cliente especial do ${businessName}, liberamos um desconto exclusivo para adicionar um novo serviço no seu próximo agendamento VIP! 💎`,
       anti_spam_days: 45,
       is_active: false
    });

    return suggestions;
  },

  getCampaigns: async (businessId: string): Promise<SmartCampaign[]> => {
    const q = query(collection(db, "smart_campaigns"), where("business_id", "==", businessId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartCampaign));
  },

  createCampaign: async (businessId: string, campaignData: Partial<SmartCampaign>) => {
    const ref = await addDoc(collection(db, "smart_campaigns"), {
      business_id: businessId,
      ...campaignData,
      performance: { sent: 0, opened: 0, converted: 0, revenue_generated: 0 },
      created_at: serverTimestamp(),
    });
    return ref.id;
  },

  updateCampaign: async (campaignId: string, data: Partial<SmartCampaign>) => {
    await updateDoc(doc(db, "smart_campaigns", campaignId), data);
  },

  deleteCampaign: async (campaignId: string) => {
    await deleteDoc(doc(db, "smart_campaigns", campaignId));
  },

  toggleCampaignStatus: async (campaignId: string, isActive: boolean) => {
    await updateDoc(doc(db, "smart_campaigns", campaignId), { is_active: isActive });
  },

  simulateExecution: async (campaignId: string, currentPerformance: SmartCampaign['performance']) => {
    // Simula um disparo de campanha para atualizar a performance
    // Na vida real isso seria feito por um trigger/cloud function.
    const newSent = Math.floor(Math.random() * 20) + 5;
    const newOpened = Math.floor(newSent * 0.8);
    const newConverted = Math.floor(newOpened * 0.3);
    const newRevenue = newConverted * 80;

    const perf = {
      sent: currentPerformance.sent + newSent,
      opened: currentPerformance.opened + newOpened,
      converted: currentPerformance.converted + newConverted,
      revenue_generated: currentPerformance.revenue_generated + newRevenue
    };

    await updateDoc(doc(db, "smart_campaigns", campaignId), { performance: perf });
    return perf;
  }
};
