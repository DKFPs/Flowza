import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as Sentry from "@sentry/react";
import { scrubPII } from "./logger";

/**
 * Flowza Analytics Service - Observability Module
 * Handles business metrics, user events, and specific alerts.
 */

export interface EventData {
  userId?: string;
  businessId?: string;
  [key: string]: unknown;
}

class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Módulo 3 e Módulo 5: Rastrear eventos de negócios ou ações de usuário
   */
  public async trackEvent(eventName: string, data?: EventData) {
    const scrubbedData = scrubPII(data || {});
    
    // Log para console
    console.log(`[ANALYTICS] ${eventName}`, scrubbedData);
    
    // Integrar com breadcrumb do Sentry para rastro de sessão
    Sentry.addBreadcrumb({
      category: "app.analytics",
      message: eventName,
      level: "info",
      data: scrubbedData
    });

    try {
      if (db) {
        // Enviar para a coleção system_events para construção de painel interno
        await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             level: "info",
             event: eventName,
             type: "business_metric",
             user_id: data?.userId || "anonymous",
             business_id: data?.businessId || "system",
             status: "success",
             metadata: scrubbedData
          })
        });
      }
    } catch (error) {
      console.warn("Analytics Error:", error);
    }
  }

  /**
   * Módulo 4: Rastreamento simplificado de performance do usuário
   */
  public measurePerformance(metricName: string, durationMs: number, metadata?: EventData) {
    // Registra métrica de performance nos logs p/ Sentry e DB
    console.log(`[PERFORMANCE] ${metricName}: ${durationMs}ms`, metadata);
    this.trackEvent(`perf_${metricName}`, { duration: durationMs, ...metadata });
  }
}

export const analytics = AnalyticsService.getInstance();
