import { db } from './firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { logger } from './logger';
import { enqueueJob } from './queue';
import { analyzeDataAndGenerateInsights } from './mlInsights';

/**
 * Função simulada de Auto-Healing / Reconciliação (Módulo 7)
 * Em produção, deveria rodar em um Cron Job Backend.
 */
export const runReconciliationJob = async (businessId: string) => {
  logger.info(`Starting reconciliation job for ${businessId}`, { businessId });
  let fixedCount = 0;

  try {
    // 1. Procurar Agendamentos em estado inconsistente 
    // (ex: reservados há mais de 1 hora sem confirmação / pagamento)
    const appointmentsRef = collection(db, 'appointments');
    // Para simplificar no firestore simulando um filtro. 
    // Em prod seria: where('status', '==', 'pending'), where('createdAt', '<', oneHourAgo)
    const q = query(
      appointmentsRef,
      where('business_id', '==', businessId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    
    // Filtro na memória para fins didáticos (simulando 1 hora atrás)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const createdAt = data.created_at?.toMillis ? data.created_at.toMillis() : Date.now();
      
      if (createdAt < oneHourAgo) {
         // Cancela automaticamente
         logger.info(`Auto-healing: Canceling expired appointment ${docSnapshot.id}`, { businessId, appointmentId: docSnapshot.id });
         await updateDoc(doc(db, 'appointments', docSnapshot.id), {
             status: 'cancelled',
             cancellation_reason: 'auto_healing_timeout',
             updated_at: serverTimestamp()
         });
         fixedCount++;
      }
    }

    // 2. Reprocessar Jobs Falhos Antigos que poderiam não ter maxRetry estourado 
    // (A fila já lida um pouco com isso, isso é uma garantia extra)
    const queueQ = query(
        collection(db, 'processing_queue'),
        where('businessId', '==', businessId),
        where('status', '==', 'failed')
    );
    
    const queueSnap = await getDocs(queueQ);
    const now = Date.now();
    for (const qDoc of queueSnap.docs) {
      const data = qDoc.data();
      if ((data.retryCount < data.maxRetries) && data.nextRetryAt && data.nextRetryAt < now) {
         logger.info(`Auto-healing: Re-enqueuing stuck job ${qDoc.id}`);
         // Recriamos na fila para garantir processamento limpo
         await enqueueJob({
             type: data.type,
             payload: data.payload,
             businessId: data.businessId,
         }, data.maxRetries);
         // "Cancela" o antigo
         await updateDoc(doc(db, 'processing_queue', qDoc.id), {
             status: 'completed',
             error: data.error + ' [Re-enqueued by healing]',
             updatedAt: serverTimestamp()
         });
         fixedCount++;
      }
    }

    logger.info(`Reconciliation job finished for ${businessId}. Fixed ${fixedCount} issues.`, { businessId, fixedCount });

    // Se houve auto-healing, executar motor de aprendizado para investigar as causas prováveis e sugerir mudanças
    if (fixedCount > 0) {
      await analyzeDataAndGenerateInsights(businessId);
    }
  } catch (error) {
    logger.error(`Reconciliation job failed for ${businessId}`, error, { businessId });
  }
};
