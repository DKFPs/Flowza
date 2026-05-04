import { collection, addDoc, serverTimestamp, updateDoc, doc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PlaybookLog {
  id?: string;
  business_id: string;
  playbook_id: string;
  status: 'executed' | 'rolled_back';
  executed_at: unknown;
  actions_taken: unknown; // data stored for rollback
}

export const PlaybookService = {
  logExecution: async (businessId: string, playbookId: string, actionsTaken: unknown) => {
    const logRef = await addDoc(collection(db, "playbook_logs"), {
      business_id: businessId,
      playbook_id: playbookId,
      status: 'executed',
      executed_at: serverTimestamp(),
      actions_taken: actionsTaken
    });
    return logRef.id;
  },

  logRollback: async (logId: string) => {
    await updateDoc(doc(db, "playbook_logs", logId), {
      status: 'rolled_back',
      rolled_back_at: serverTimestamp()
    });
  },

  getExecutedPlaybooks: async (businessId: string) => {
    const q = query(collection(db, "playbook_logs"), where("business_id", "==", businessId), where("status", "==", "executed"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PlaybookLog));
  },

  // --- Playbook Actions ---

  // 1. Reduzir faltas -> Ativar alertas e adicionar config
  executeReduceFaltas: async (businessId: string) => {
    // Ação: ativar lembrete 2h antes e mensagem via WhatsApp (simulação na collection business)
    await updateDoc(doc(db, "businesses", businessId), {
      reminders_enabled: true,
      reminder_hours: 2,
      whatsapp_alerts: true
    });
    return { type: 'business_update', data: { reminders_enabled: false, reminder_hours: 24, whatsapp_alerts: false } };
  },

  rollbackReduceFaltas: async (businessId: string, revertData: unknown) => {
    const data = revertData as Record<string, unknown>;
    await updateDoc(doc(db, "businesses", businessId), {
      reminders_enabled: data?.reminders_enabled || false,
      whatsapp_alerts: data?.whatsapp_alerts || false
    });
  },

  // 2. Reativar clientes -> Criar campanha de bônus
  executeReactivation: async (businessId: string) => {
    // Ação: Adicionar benefício no loyalty para reativação
    const ref = await addDoc(collection(db, "loyalty_rewards"), {
      business_id: businessId,
      name: "Bônus de Reativação 2x",
      description: "Clientes com mais de 30 dias sem agendar recebem pontos em dobro no próximo agendamento (Automático através de Playbook).",
      points_required: 0,
      discount_amount: 0,
      reward_type: "reactivation_campaign",
      is_active: true,
      created_at: serverTimestamp()
    });
    return { type: 'create_reward', data: { reward_id: ref.id } };
  },

  rollbackReactivation: async (rewardId: string) => {
    if (rewardId) {
      await deleteDoc(doc(db, "loyalty_rewards", rewardId));
    }
  },

  // 3. Aumentar recorrência -> Pacote ou benefício
  executeRecurrence: async (businessId: string) => {
    const ref = await addDoc(collection(db, "loyalty_rewards"), {
      business_id: businessId,
      name: "Campanha: Agende 3 e ganhe 1 brinde",
      description: "Incentivo criado pelo Playbook de Recorrência.",
      points_required: 150,
      discount_amount: 0,
      reward_type: "recurrence_campaign",
      is_active: true,
      created_at: serverTimestamp()
    });
    return { type: 'create_reward', data: { reward_id: ref.id } };
  },

  // 4. Aumentar ticket médio -> Cross-sell / Up-sell nas mensagens
  executeTicketMedio: async (businessId: string) => {
    await updateDoc(doc(db, "businesses", businessId), {
      upsell_enabled: true,
      upsell_message: "Que tal adicionar uma hidratação ou serviço extra?"
    });
    return { type: 'business_update', data: { upsell_enabled: false } };
  },

  rollbackTicketMedio: async (businessId: string, revertData: unknown) => {
    const data = revertData as Record<string, unknown>;
    await updateDoc(doc(db, "businesses", businessId), {
      upsell_enabled: data?.upsell_enabled || false
    });
  }
};
