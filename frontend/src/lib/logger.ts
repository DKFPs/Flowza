import { apiFetch } from "@/lib/api";
import * as Sentry from "@sentry/react";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Flowza Logger Service - Observability Module
 * Handles error tracking and basic monitoring.
 */

export enum LogLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  DEBUG = "debug"
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown> | unknown;
  timestamp: string;
  userId?: string;
  businessId?: string;
}

// Módulo 9: Privacidade - Anonimização
export const scrubPII = (data: unknown): unknown => {
  if (!data) return data;
  try {
    const stringified = JSON.stringify(data);
    
    // Redact CPF
    let scrubbed = stringified.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "***.***.***-**");
    // Redact full email
    scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");
    // Simple phone redact
    scrubbed = scrubbed.replace(/\(?\d{2}\)?\s?\d{4,5}-\d{4}/g, "(**) *****-****");
    
    return JSON.parse(scrubbed);
  } catch (e) {
    return "[Unserializable Data]";
  }
};

class Logger {
  private static instance: Logger;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Módulo 2 e Módulo 10: Logs estruturados gravados para Dashboard
  private async persistLog(entry: LogEntry) {
    try {
      // Ignorar persistência se DB não estiver inicializado ou em ambientes não adequados
      if (!db) return;
      
      const scrubbedContext = scrubPII(entry.context);
      
      const payload = {
        level: entry.level,
        event: entry.message, // Map message to event for structured logs
        user_id: entry.userId || "anonymous",
        business_id: entry.businessId || "system",
        status: entry.level === LogLevel.ERROR ? "error" : "info",
        metadata: scrubbedContext || {},
        created_at: serverTimestamp()
      };

      await apiFetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Failed to persist log to Firestore", e);
    }
  }

  private writeLog(entry: LogEntry) {
    const styles = {
      [LogLevel.INFO]: "color: #3b82f6",
      [LogLevel.WARN]: "color: #f59e0b",
      [LogLevel.ERROR]: "color: #ef4444; font-weight: bold",
      [LogLevel.DEBUG]: "color: #10b981"
    };

    console.log(
      `%c[${entry.level.toUpperCase()}] %c${entry.timestamp}: ${entry.message}`,
      styles[entry.level],
      "color: inherit",
      entry.context || ""
    );

    // Módulo 1: Sentry Integration
    if (entry.level === LogLevel.ERROR) {
      const scrubbedContext = scrubPII(entry.context);
      Sentry.withScope((scope) => {
        if (entry.userId) scope.setUser({ id: entry.userId });
        if (entry.businessId) scope.setTag("business_id", entry.businessId);
        if (scrubbedContext) scope.setExtras(scrubbedContext as Record<string, unknown>);
        
        let sentryError = entry.message;
        if (entry.context && typeof entry.context === 'object' && 'error' in entry.context) {
          const e = (entry.context as Record<string, unknown>).error;
          sentryError = (e as Error)?.message || sentryError;
        }

        Sentry.captureException(new Error(sentryError));
      });
    } else {
      // Breadcrumbs for reproduction (Módulo 8)
      Sentry.addBreadcrumb({
        category: "app.log",
        message: entry.message,
        level: entry.level === LogLevel.ERROR ? "error" : 
               entry.level === LogLevel.WARN ? "warning" : "info",
        data: scrubPII(entry.context)
      });
    }

    // Persist critical logs to Firebase for Dashboard
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.WARN) {
      this.persistLog(entry);
    }
  }

  public info(message: string, context?: Record<string, unknown> | unknown) {
    this.writeLog({
      level: LogLevel.INFO,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  public warn(message: string, context?: Record<string, unknown> | unknown) {
    this.writeLog({
      level: LogLevel.WARN,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  public error(message: string, error?: Error | unknown, context?: Record<string, unknown> | unknown) {
    const errorBody = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    this.writeLog({
      level: LogLevel.ERROR,
      message,
      context: { 
        ...(typeof context === 'object' && context !== null ? context : {}), 
        error: errorBody 
      },
      timestamp: new Date().toISOString()
    });
  }

  public debug(message: string, context?: Record<string, unknown> | unknown) {
    if (process.env.NODE_ENV !== 'production') {
      this.writeLog({
        level: LogLevel.DEBUG,
        message,
        context,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Set default context for the session (auth)
  public setUserContext(userId?: string, businessId?: string) {
    if (userId) Sentry.setUser({ id: userId });
    if (businessId) Sentry.setTag("business_id", businessId);
  }
}

export const logger = Logger.getInstance();
