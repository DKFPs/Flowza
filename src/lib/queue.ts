import { db } from './firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { logger } from './logger';
import { ErrorType, classifyError } from './resilience';

export interface QueueJob {
  id?: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  businessId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  error?: string;
}

export const enqueueJob = async (job: Omit<QueueJob, 'status' | 'retryCount' | 'maxRetries'>, maxRetries = 3): Promise<string> => {
  try {
    const jobData = {
      ...job,
      status: 'pending',
      retryCount: 0,
      maxRetries,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'processing_queue'), jobData);
    logger.info(`Job enqueued: ${job.type}`, { jobId: docRef.id, businessId: job.businessId });
    return docRef.id;
  } catch (error) {
    logger.error(`Failed to enqueue job: ${job.type}`, error, { businessId: job.businessId });
    throw error;
  }
};

/**
 * Esse método normalmente rodaria em um ambiente Backend/Cloud Functions.
 * Vamos simular o processo da fila buscando jobs pendentes.
 */
export const processQueue = async (businessId: string, limitCount = 5) => {
  try {
    const now = Date.now();
    const q = query(
      collection(db, 'processing_queue'),
      where('businessId', '==', businessId),
      where('status', 'in', ['pending', 'failed']),
      orderBy('createdAt', 'asc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueJob));

    const jobsToProcess = jobs.filter(job => job.status === 'pending' || (job.status === 'failed' && job.nextRetryAt && job.nextRetryAt <= now && job.retryCount < job.maxRetries));

    for (const job of jobsToProcess) {
      await executeJob(job);
    }

  } catch (error) {
    logger.error('Error processing queue', error, { businessId });
  }
};

const executeJob = async (job: QueueJob) => {
  if (!job.id) return;
  const jobRef = doc(db, 'processing_queue', job.id);
  
  try {
    await updateDoc(jobRef, { status: 'processing', updatedAt: serverTimestamp() });
    
    // Switch com base no tipo de Job. Em um ambiente real, poderia haver Handlers separados.
    if (job.type === 'send_notification') {
        // Simulando processamento
        await new Promise(res => setTimeout(res, 500));
        // throw new Error("Teste de Timeout");
    } else if (job.type === 'sync_whatsapp') {
        await new Promise(res => setTimeout(res, 800));
    }

    await updateDoc(jobRef, { status: 'completed', updatedAt: serverTimestamp() });
    logger.info(`Job completed: ${job.type}`, { jobId: job.id, businessId: job.businessId });
  } catch (error) {
    const errorType = classifyError(error);
    const newRetryCount = job.retryCount + 1;
    
    if (errorType === ErrorType.PERMANENT || newRetryCount >= job.maxRetries) {
        await updateDoc(jobRef, { 
            status: 'failed', 
            error: error instanceof Error ? error.message : String(error),
            updatedAt: serverTimestamp() 
        });
        logger.error(`Job failed permanently: ${job.type}`, error, { jobId: job.id, businessId: job.businessId });
    } else {
        const backoffDelay = 1000 * Math.pow(2, newRetryCount); // Exponencial
        const nextRetryAt = Date.now() + backoffDelay;

        await updateDoc(jobRef, { 
            status: 'failed', 
            retryCount: newRetryCount,
            nextRetryAt,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: serverTimestamp() 
        });
        logger.warn(`Job failed, scheduling retry: ${job.type}`, { jobId: job.id, newRetryCount, backoffDelay });
    }
  }
};
