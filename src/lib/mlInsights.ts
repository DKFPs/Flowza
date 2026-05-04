import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, limit, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { logger } from './logger';

export interface LearningInsight {
  id?: string;
  businessId: string;
  title: string;
  description: string;
  category: 'error' | 'ux' | 'performance';
  severity: 'low' | 'medium' | 'critical';
  metric: string;
  metricValue: number;
  status: 'pending' | 'applied' | 'rejected';
  suggestedAction: string;
  createdAt?: unknown;
  appliedAt?: unknown;
}

/**
 * Função simulada do Motor de Machine Learning (Módulo 1-6).
 * Analisa logs, eventos analíticos e agendamentos para gerar insights e recomendações.
 */
export const analyzeDataAndGenerateInsights = async (businessId: string) => {
  logger.info(`Starting ML analysis for business: ${businessId}`);
  
  try {
    // 1. Analisar cancelamentos (UX / Retenção)
    const appointmentsRef = collection(db, 'appointments');
    const qCancelled = query(
      appointmentsRef,
      where('business_id', '==', businessId),
      where('status', '==', 'cancelled')
    );
    
    // Obteríamos uma base grande, simulando um sample pequeno
    const cancelledSnap = await getDocs(qCancelled);
    const cancelRate = cancelledSnap.size; // Em prod, seria (Cancelados / Total) * 100

    if (cancelRate > 5) {
      await createInsightIfUnique({
        businessId,
        title: 'Alta taxa de cancelamento detectada',
        description: `Notamos um pico de ${cancelRate} cancelamentos recentes. Muitos parecem ocorrer pouco antes do horário.`,
        category: 'ux',
        severity: 'medium',
        metric: 'Cancelamentos Recentes',
        metricValue: cancelRate,
        status: 'pending',
        suggestedAction: 'Ativar política de restrição de cancelamento em menos de 2h e lembrete ativo no WhatsApp.'
      });
    }

    // 2. Analisar falhas na fila (Integrações/Performance)
    const queueRef = collection(db, 'processing_queue');
    const qFailedQueue = query(
      queueRef,
      where('businessId', '==', businessId),
      where('status', '==', 'failed')
    );
    const queueFailedSnap = await getDocs(qFailedQueue);
    
    if (queueFailedSnap.size > 2) {
       await createInsightIfUnique({
        businessId,
        title: 'Falhas Críticas em Integrações Externas',
        description: `O sistema de retry não foi capaz de recuperar ${queueFailedSnap.size} requisições críticas recentemente.`,
        category: 'error',
        severity: 'critical',
        metric: 'Falhas Finais',
        metricValue: queueFailedSnap.size,
        status: 'pending',
        suggestedAction: 'Aumentar baseDelay do Backoff Exponencial para evitar Rate Limits e notificar T.I.'
      });
    }

    // 3. Analisar funil de pagamento (Performance / Conversão)
    // Simulação de um funil de observabilidade
    const qEvents = query(
      collection(db, 'system_events'),
      where('business_id', '==', businessId),
      where('level', '==', 'warn'),
      limit(20)
    );
    const eventsSnap = await getDocs(qEvents);
    let uxIssues = 0;
    eventsSnap.forEach(doc => {
        const d = doc.data();
        if (d.event?.toLowerCase().includes('validação')) uxIssues++;
    });

    if (uxIssues > 3) {
      await createInsightIfUnique({
        businessId,
        title: 'Atrito na Interface de Agendamento',
        description: `Usuários estão errando frequentemente campos de formulário (CPF/Telefone). ${uxIssues} erros de validação.`,
        category: 'ux',
        severity: 'low',
        metric: 'Erros de Input',
        metricValue: uxIssues,
        status: 'pending',
        suggestedAction: 'Ativar auto-completar inteligente e reforçar máscaras de input visuais no formulário.'
      });
    }

    logger.info(`ML Analysis complete for ${businessId}`);
  } catch (error) {
     logger.error('Error running ML Analysis', error, { businessId });
  }
};

/**
 * Cria o insight se já não existir um pendente com a mesma ação.
 */
async function createInsightIfUnique(insight: LearningInsight) {
    const q = query(
        collection(db, 'learning_insights'),
        where('businessId', '==', insight.businessId),
        where('title', '==', insight.title),
        where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
        await addDoc(collection(db, 'learning_insights'), {
            ...insight,
            createdAt: serverTimestamp()
        });
        logger.info(`New ML Insight created: ${insight.title}`);
    }
}

export const applyInsightAction = async (insightId: string) => {
    try {
        const ref = doc(db, 'learning_insights', insightId);
        await updateDoc(ref, {
            status: 'applied',
            appliedAt: serverTimestamp()
        });
        // Em um sistema real, leríamos a ação proposta e faríamos mutações em BD ou EnvVars aqui.
        logger.info(`Insight action applied: ${insightId}`);
        return true;
    } catch (e) {
        logger.error(`Error applying insight ${insightId}`, e);
        return false;
    }
};

export const rejectInsightAction = async (insightId: string) => {
    try {
        const ref = doc(db, 'learning_insights', insightId);
        await updateDoc(ref, {
            status: 'rejected'
        });
        return true;
    } catch (e) {
        return false;
    }
};
