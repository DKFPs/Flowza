import { logger } from './logger';

export enum ErrorType {
  TRANSIENT = 'transient', // Rede, Timeout, Rate Limit
  PERMANENT = 'permanent', // Validação de Dados, Não Encontrado
  EXTERNAL = 'external' // API Pagamento, WhatsApp falhou
}

export interface ResilienceConfig {
  enabled: boolean;
  maxRetries: number;
  baseDelay: number; // ms
}

const defaultConfig: ResilienceConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelay: 1000
};

export const classifyError = (error: unknown): ErrorType => {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status = (error as { status?: number; code?: number | string })?.status || (error as { status?: number; code?: number | string })?.code;

  if (
    msg.includes('timeout') ||
    msg.includes('network') ||
    status === 429 ||
    status === 503 ||
    status === 502 ||
    status === 504 ||
    msg.includes('rate limit') ||
    msg.includes('the client is offline') ||
    msg.includes('quota') ||
    msg.includes('too many requests')
  ) {
    return ErrorType.TRANSIENT;
  }

  if (
    msg.includes('stripe') ||
    msg.includes('whatsapp') ||
    msg.includes('third party') ||
    msg.includes('external') ||
    msg.includes('integra')
  ) {
    return ErrorType.EXTERNAL;
  }

  return ErrorType.PERMANENT;
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  context: { operationName: string; businessId?: string; [key: string]: unknown },
  config: Partial<ResilienceConfig> = {}
): Promise<T> => {
  const mergedConfig = { ...defaultConfig, ...config };
  if (!mergedConfig.enabled) {
    return operation();
  }

  let attempt = 0;
  
  while (attempt <= mergedConfig.maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      const type = classifyError(error);

      logger.warn(`Failure detected in ${context.operationName}`, {
        ...context,
        attempt,
        errorType: type,
        error: error instanceof Error ? error.message : String(error)
      });

      if (type === ErrorType.PERMANENT) {
        logger.error(`Permanent failure in ${context.operationName}. Aborting.`, error, context);
        throw error;
      }

      if (attempt > mergedConfig.maxRetries) {
        logger.error(`Max retries reached for ${context.operationName}.`, error, context);
        throw error;
      }

      const delay = mergedConfig.baseDelay * Math.pow(2, attempt - 1);
      
      logger.info(`Retrying ${context.operationName} in ${delay}ms... (Attempt ${attempt}/${mergedConfig.maxRetries})`, context);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
};

export const withFallback = async <T, F>(
  operation: () => Promise<T>,
  fallback: (error: unknown) => Promise<F>,
  context: { operationName: string; businessId?: string; [key: string]: unknown }
): Promise<T | F> => {
  try {
    return await operation();
  } catch (error) {
    const type = classifyError(error);
    
    logger.warn(`Operation failed, executing fallback for ${context.operationName}`, {
      ...context,
      errorType: type,
      error: error instanceof Error ? error.message : String(error)
    });

    return await fallback(error);
  }
}
