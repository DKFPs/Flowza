import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { generateAutoSEO } from "./src/services/seoService.ts";
import axios from "axios";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc, runTransaction, increment, limit } from 'firebase/firestore';
import { adminDb as realAdminDb, adminAuth as realAdminAuth } from "./src/lib/firebaseAdmin.js";
import { FieldValue } from 'firebase-admin/firestore';
const adminDb: any = realAdminDb;
const adminAuth: any = realAdminAuth;

// --- Middleware & Limits ---
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const getProfessionalsLimit = (plan: string) => {
  const p = plan.toUpperCase();
  if (['PREMIUM', 'BUSINESS'].includes(p)) return 999;
  if (p === 'PRO') return 5;
  return 1;
};

const getServicesLimit = (plan: string) => {
  const p = plan.toUpperCase();
  if (['FREE'].includes(p)) return 3;
  return 999;
};

import * as Sentry from "@sentry/node";

dotenv.config();

async function logSecurityEvent(type: string, ipHash: string, businessId: string, phoneHash: string, reason: string) {
  try {
    await adminDb.collection("security_events").add({
      type,
      ipHash,
      businessId,
      phoneHash,
      reason,
      createdAt: FieldValue.serverTimestamp(),
      severity: type === "invalid_bot_token" || type === "suspicious_booking_pattern" ? "high" : "medium"
    });
  } catch(e) {}
}


// Módulo 1: Inicializa Sentry no servidor
Sentry.init({
  dsn: process.env.SENTRY_DSN || "", // Usa env ou local
  tracesSampleRate: 1.0,
});

// Initialize Firebase for the backend worker
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'firebase-applet-config.json'), 'utf-8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Server Side Logger (Módulo 2, 7)
async function trackServerEvent(level: string, event: string, type: string, metadata: any) {
  try {
    const safeData = JSON.parse(JSON.stringify(metadata, (k, v) => (k === "stack" ? undefined : v)));
    
    // Log para Observability Dashboard
    await adminDb.collection("system_events").add({
      level,
      event,
      type,
      user_id: "system",
      business_id: metadata?.business_id || "system",
      status: level === "error" ? "failure" : "success",
      metadata: safeData,
      created_at: FieldValue.serverTimestamp()
    });

    if (level === "error") {
      Sentry.captureException(new Error(event), { extra: metadata });
    }
  } catch (err: any) {
    if (err?.code === 7 || err?.message?.includes('Missing or insufficient permissions')) {
      // Silently fail if admin SDK lacks permissions
    } else {
      console.error("Failed to track server event", err);
    }
  }
}

// Background Worker: MÓDULO 3 — FILA DE PROCESSAMENTO (WHATSAPP)
function startQueueWorker() {
  console.log("[WORKER] Background queue processor started...");
  setInterval(async () => {
    try {
      const q = adminDb.collection("notification_queue").where("status", "==", "pending");
      const snap = await q.get();
      
      snap.forEach(async (document: any) => {
        const data = document.data();
        const docRef = adminDb.collection("notification_queue").doc(document.id);
        
        try {
          const bizSnap = await adminDb.collection("businesses").where("__name__", "==", data.business_id || "unknown").limit(1).get();
          let planId = "FREE";
          if (!bizSnap.empty) {
             const bizPlan = bizSnap.docs[0].data().plan_id;
             planId = bizPlan ? bizPlan.toUpperCase() : "FREE";
          }
          
          if (planId !== "PRO" && planId !== "BUSINESS" && planId !== "PREMIUM") {
             throw new Error("Plan does not permit WhatsApp notifications (Needs PRO or higher)");
          }

          // Simulate some external API failure for WhatsApp (e.g., 20% chance of failure)
          if (Math.random() > 0.8) {
            throw new Error("Simulated WhatsApp API Timeout or Error");
          }
          
          await docRef.update({
            status: "sent",
            sent_at: FieldValue.serverTimestamp()
          });
          console.log(`[WORKER] Successfully sent WhatsApp for ${data.payload?.client_name || 'Client'} (APT: ${data.appointment_id})`);
          
          await trackServerEvent("info", "whatsapp_sent_success", "integration", { appointment_id: data.appointment_id });

        } catch (error) {
          const retries = (data.retry_count || 0) + 1;
          const msg = error instanceof Error ? error.message : "Unknown error";
          console.warn(`[WORKER] Failed to send WhatsApp for ${document.id}. Retry: ${retries}`);
          
          await docRef.update({
            status: retries >= 3 ? "failed" : "pending",
            retry_count: retries,
            last_error: msg,
            updated_at: FieldValue.serverTimestamp(),
            // Backoff exponencial
            next_retry: new Date(Date.now() + Math.pow(2, retries) * 1000).toISOString()
          });

          // Módulo 7: Erro em integração - Alertas via Logger Interno e Sentry
          await trackServerEvent("error", "whatsapp_api_failure", "integration", {
             appointment_id: data.appointment_id,
             retries,
             error: msg
          });
        }
      });
    } catch (e: any) {
      if (e?.code === 7 || e?.message?.includes('Missing or insufficient permissions')) {
        // Silently skip if admin SDK lacks permissions
      } else {
        console.error("[WORKER] Error processing queue:", e);
        // Módulo 1/7: Report Worker Error
        trackServerEvent("error", "worker_loop_failure", "system", { error: e instanceof Error ? e.message : String(e) });
      }
    }
  }, 10000); // Check every 10 seconds
}

startQueueWorker();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_SECRET_KEY) {
  throw new Error("FATAL: STRIPE_SECRET_KEY is missing in production.");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Mock de dados para SEO em SSR (No mundo real, buscaria no banco)
const mockBusinessData = {
  "demo-business": { name: "Flowza Studio", city: "São Paulo", plan: "BUSINESS" as const },
  "servico-premium": { name: "Serviço Premium", businessName: "Flowza Studio" }
};

// Cidades e Serviços reais para expansão automática de páginas
const seoOpportunities = {
  cities: ["São Paulo", "Rio de Janeiro", "Belo Horizonte"],
  services: ["Consultoria", "Bem-estar", "Estética"]
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  const getPlanFromStripePriceId = (priceId: string | undefined): string | null => {
    if (!priceId) return null;
    const priceToPlan: Record<string, string> = {};
    if (process.env.STRIPE_PRICE_PRO_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_PRO_MONTHLY] = 'PRO';
    if (process.env.STRIPE_PRICE_BUSINESS_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_BUSINESS_MONTHLY] = 'BUSINESS';
    if (process.env.STRIPE_PRICE_PREMIUM_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_PREMIUM_MONTHLY] = 'PREMIUM';
    if (process.env.STRIPE_PRICE_PRO_YEARLY) priceToPlan[process.env.STRIPE_PRICE_PRO_YEARLY] = 'PRO';
    if (process.env.STRIPE_PRICE_BUSINESS_YEARLY) priceToPlan[process.env.STRIPE_PRICE_BUSINESS_YEARLY] = 'BUSINESS';
    if (process.env.STRIPE_PRICE_PREMIUM_YEARLY) priceToPlan[process.env.STRIPE_PRICE_PREMIUM_YEARLY] = 'PREMIUM';
    
    // Fallback for DEV mode
    priceToPlan['price_pro_monthly'] = 'PRO';
    priceToPlan['price_business_monthly'] = 'BUSINESS';
    priceToPlan['price_premium_monthly'] = 'PREMIUM';

    return priceToPlan[priceId] || null;
  };

  // Webhooks de terceiros que precisam de payload "raw" (sem ser parseado como JSON padrão)
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (endpointSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
      } else {
        // Warning: Local development / no webhook secret
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const businessId = session.client_reference_id || session.metadata?.businessId;
          const planId = session.metadata?.planId;
          
          if (businessId) {
             const businessRef = adminDb.collection("businesses").doc(businessId);
             
             const updateData: any = {
                subscription_status: 'active',
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
             };
             
             if (planId) {
                updateData.plan_id = planId;
             }

             await businessRef.update(updateData);
             
             await adminDb.collection('subscriptions').doc(businessId).set({
                business_id: businessId,
                plan_id: planId || "FREE",
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                status: 'active',
                updated_at: new Date().toISOString()
             });

             await trackServerEvent("info", "subscription_activated", "billing", { business_id: businessId, plan_id: planId, customer_id: session.customer });
          }
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            const q = await adminDb.collection('businesses').where('stripe_customer_id', '==', invoice.customer).get();
            if (!q.empty) {
              const bizId = q.docs[0].id;
              await adminDb.collection('businesses').doc(bizId).update({
                subscription_status: 'active'
              });
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const q = await adminDb.collection('businesses').where('stripe_customer_id', '==', invoice.customer).get();
          if (!q.empty) {
             const bizId = q.docs[0].id;
             await adminDb.collection('businesses').doc(bizId).update({
               subscription_status: 'past_due'
             });
             // No Flowza, past_due perde acesso imediato conforme pedido no prompt de auditoria (usuário pagamento recusado)
          }
          break;
        }
        case 'customer.subscription.updated': {
           const subscription = event.data.object;
           const qQuery = await adminDb.collection('businesses').where('stripe_customer_id', '==', subscription.customer).get();
           if (!qQuery.empty) {
             const businessId = qQuery.docs[0].id;
             let planId = subscription.metadata?.planId || qQuery.docs[0].data().plan_id;
             
             // Extract priceId from the first subscription item
             const priceId = subscription.items?.data?.[0]?.price?.id;
             if (priceId) {
                const verifiedPlan = getPlanFromStripePriceId(priceId);
                if (verifiedPlan) {
                   planId = verifiedPlan;
                } else {
                   console.error(`Invalid plan or priceId for subscription ${subscription.id}: ${priceId}`);
                   await trackServerEvent("security", "invalid_price_id", "billing", { business_id: businessId, price_id: priceId });
                   // Fallback to FREE or don't adjust plan if unknown?
                   // Just leave the current plan or set to FREE. Let's not grant higher access.
                }
             }

             await adminDb.collection('businesses').doc(businessId).update({
               subscription_status: subscription.status,
               plan_id: planId
             });
             
             const subQ = await adminDb.collection('subscriptions').where('stripe_subscription_id', '==', subscription.id).get();
             if (!subQ.empty) {
               await adminDb.collection('subscriptions').doc(subQ.docs[0].id).update({
                 status: subscription.status,
                 plan_id: planId,
                 updated_at: new Date().toISOString()
               });
             }
           }
           break;
        }
        case 'customer.subscription.deleted': {
           const subscription = event.data.object;
           const qQuery = await adminDb.collection('businesses').where('stripe_customer_id', '==', subscription.customer).get();
           if (!qQuery.empty) {
             const businessId = qQuery.docs[0].id;
             await adminDb.collection('businesses').doc(businessId).update({
               subscription_status: 'canceled',
               plan_id: 'FREE'
             });
             
             const subQ = await adminDb.collection('subscriptions').where('stripe_subscription_id', '==', subscription.id).get();
             if (!subQ.empty) {
               await adminDb.collection('subscriptions').doc(subQ.docs[0].id).update({
                 status: 'canceled',
                 plan_id: 'FREE',
                 updated_at: new Date().toISOString()
               });
             }

             await trackServerEvent("info", "subscription_canceled", "billing", { customer_id: subscription.customer, business_id: businessId });
           }
           break;
        }
      }
    } catch (e) {
      console.error("Error processing Stripe Webhook", e);
    }

    res.status(200).end();
  });

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  // Sitemap Dinâmico Avançado
  app.get("/sitemap.xml", (req, res) => {
    res.header("Content-Type", "application/xml");
    
    const urls = [
      { loc: "https://ais-dev.run.app/", priority: "1.0" },
      { loc: "https://ais-dev.run.app/demo-business", priority: "0.8" },
      { loc: "https://ais-dev.run.app/demo-business/servico-premium", priority: "0.7" }
    ];

    // Expansão automática no sitemap: Cidade + Serviço
    seoOpportunities.cities.forEach(city => {
      seoOpportunities.services.forEach(service => {
        const citySlug = service.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const serviceSlug = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
        urls.push({ 
          loc: `https://ais-dev.run.app/${serviceSlug}/${citySlug}`, 
          priority: "0.5" 
        });
      });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
  </url>`).join('')}
</urlset>`;
    res.send(sitemap);
  });

  // Robots.txt
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dashboard/\nSitemap: https://ais-dev.run.app/sitemap.xml");
  });

  // API Routes
  app.post("/api/log", express.json(), async (req, res) => {
    try {
      const payload = req.body;
      const result = await adminDb.collection("system_events").add({
        ...payload,
        created_at: FieldValue.serverTimestamp()
      });
      console.log(`[API_LOG] Event tracked: ${payload.event} (ID: ${result.id})`);
      res.json({ success: true, id: result.id });
    } catch (error) {
      // Gracefully return 200 so the client doesn't break, silently ignoring permission issues
      res.json({ success: false, warning: "Admin SDK not configured properly for logging" });
    }
  });
  
  // --- AI Availability & Validation ---
  app.post("/api/availability", express.json(), async (req, res) => {
    try {
      const { businessId, professionalId, date, duration, checkOnlyTime } = req.body;
      if (!businessId || !professionalId || !date || !duration) {
        return res.status(400).json({ error: "Missing required params" });
      }

      // Fetch professional data for constraints
      const profSnap = await adminDb.collection("professionals").doc(professionalId).get();
      const profData = profSnap.exists ? profSnap.data() : null;
      const buffer = profData?.buffer_minutes || 0;

      // Fetch appointments for that day
      const snap = await adminDb.collection("appointments")
        .where("business_id", "==", businessId)
        .where("professional_id", "==", professionalId)
        .where("appointment_date", "==", date)
        .where("status", "!=", "cancelled")
        .limit(50)
        .get();
      const appointments = snap.docs.map((d: any) => d.data());

      // Helper functions
      const timeToMins = (t: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':');
          return Number(h) * 60 + Number(m);
      };

      // Check specific slot for validation if checkOnlyTime is provided
      if (checkOnlyTime) {
          const m = timeToMins(checkOnlyTime);
          const slotStart = m;
          const slotEnd = m + duration;
          
          let hasConflict = false;
          
          // Check breaks
          const dayOfWeek = new Date(date + "T00:00:00").getDay();
          if (profData?.breaks && Array.isArray(profData.breaks)) {
              hasConflict = profData.breaks.some((b: any) => {
                  if (b.days && !b.days.includes(dayOfWeek)) return false;
                  const breakStart = timeToMins(b.start);
                  const breakEnd = timeToMins(b.end);
                  return slotStart < breakEnd && slotEnd > breakStart;
              });
          }

          if (!hasConflict) {
             hasConflict = appointments.some((apt: any) => {
                 if (!apt.start_time) return false;
                 const aptStart = timeToMins(apt.start_time);
                 const aptEnd = apt.end_time ? timeToMins(apt.end_time) : aptStart + 30;
                 // Add buffer to existing appointments when checking
                 return slotStart < (aptEnd + buffer) && slotEnd > (aptStart - buffer);
             });
          }
          
          return res.json({ available: !hasConflict, conflict: hasConflict });
      }

      // If checkOnlyTime is not provided, generate available slots
      const startMins = timeToMins("08:00");
      const endMins = timeToMins("18:00");
      const intervalMinutes = 30;
      const slots: string[] = [];

      for (let m = startMins; m <= endMins - duration; m += intervalMinutes) {
          const slotStart = m;
          const slotEnd = m + duration;
          const hasConflict = appointments.some((apt: any) => {
              if (!apt.start_time) return false;
              const aptStart = timeToMins(apt.start_time);
              const aptEnd = apt.end_time ? timeToMins(apt.end_time) : aptStart + 30;
              return slotStart < aptEnd && slotEnd > aptStart;
          });

          if (!hasConflict) {
              const hh = Math.floor(m / 60).toString().padStart(2, '0');
              const mm = (m % 60).toString().padStart(2, '0');
              slots.push(`${hh}:${mm}`);
          }
      }

      res.json({ slots });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate availability" });
    }
  });

// --- ADMIN ENDPOINTS (PROFESSIONALS & SERVICES) ---
  app.post("/api/professionals", express.json(), authenticateUser, async (req: any, res) => {
    try {
      const { businessId, name, specialty, description, buffer_minutes, working_hours, working_days, avatar_url } = req.body;
      const uid = req.user.uid;

      const result = await adminDb.runTransaction(async (transaction: any) => {
        const bizRef = adminDb.collection("businesses").doc(businessId);
        const bizDoc = await transaction.get(bizRef);
        if (!bizDoc.exists) throw new Error("Negócio não encontrado");
        
        const biz = bizDoc.data();
        if (biz.owner_id !== uid) throw new Error("Você não tem permissão");

        const plan = biz.plan_id || 'FREE';
        const limit = getProfessionalsLimit(plan);
        const currentUsage = biz.usage_professionals || 0;

        if (currentUsage >= limit) {
          throw new Error(`Seu plano (${plan}) permite até ${limit} profissionais.`);
        }

        const newProfRef = adminDb.collection("professionals").doc();
        transaction.set(newProfRef, {
          business_id: businessId,
          name,
          specialty: specialty || null,
          description: description || null,
          avatar_url: avatar_url || null,
          is_active: true,
          buffer_minutes: buffer_minutes || 0,
          working_hours: working_hours || { start: "08:00", end: "18:00" },
          working_days: working_days || [1,2,3,4,5,6],
          created_at: FieldValue.serverTimestamp()
        });

        // Aplicar horários padrão
        if (biz.default_working_hours?.length > 0) {
          for (const h of biz.default_working_hours) {
            if (h.is_active) {
              const hourRef = adminDb.collection("working_hours").doc();
              transaction.set(hourRef, {
                business_id: businessId,
                professional_id: newProfRef.id,
                day_of_week: h.day_of_week,
                start_time: h.start_time,
                end_time: h.end_time,
                created_at: FieldValue.serverTimestamp()
              });
            }
          }
        }

        transaction.update(bizRef, {
          usage_professionals: FieldValue.increment(1)
        });

        return newProfRef.id;
      });

      res.json({ success: true, id: result });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/professionals/:id", express.json(), authenticateUser, async (req: any, res) => {
    try {
      const { businessId, name, specialty, description, buffer_minutes, working_hours, working_days, avatar_url } = req.body;
      const { id } = req.params;
      const uid = req.user.uid;

      const bizDoc = await adminDb.collection("businesses").doc(businessId).get();
      if (!bizDoc.exists || bizDoc.data().owner_id !== uid) return res.status(403).json({ error: "Sem permissão" });

      const profRef = adminDb.collection("professionals").doc(id);
      const updateData: any = {
        name,
        specialty: specialty || null,
        description: description || null,
        buffer_minutes,
        working_hours,
        working_days
      };
      if (avatar_url) updateData.avatar_url = avatar_url;

      await profRef.update(updateData);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/professionals/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { businessId } = req.query;
      const uid = req.user.uid;

      if (!businessId) return res.status(400).json({ error: "businessId required" });

      await adminDb.runTransaction(async (transaction: any) => {
        const bizRef = adminDb.collection("businesses").doc(businessId);
        const bizDoc = await transaction.get(bizRef);
        if (!bizDoc.exists || bizDoc.data().owner_id !== uid) throw new Error("Sem permissão");

        const profRef = adminDb.collection("professionals").doc(id);
        transaction.delete(profRef);

        transaction.update(bizRef, {
          usage_professionals: FieldValue.increment(-1)
        });
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/services", express.json(), authenticateUser, async (req: any, res) => {
    try {
      const { businessId, name, duration, price, description, image_url } = req.body;
      const uid = req.user.uid;

      const result = await adminDb.runTransaction(async (transaction: any) => {
        const bizRef = adminDb.collection("businesses").doc(businessId);
        const bizDoc = await transaction.get(bizRef);
        if (!bizDoc.exists || bizDoc.data().owner_id !== uid) throw new Error("Sem permissão");

        const biz = bizDoc.data();
        const plan = biz.plan_id || 'FREE';
        const limit = getServicesLimit(plan);
        const currentUsage = biz.usage_services || 0;

        if (currentUsage >= limit) {
          throw new Error(`Seu plano (${plan}) permite até ${limit} serviços.`);
        }

        const newServiceRef = adminDb.collection("services").doc();
        transaction.set(newServiceRef, {
          business_id: businessId,
          name,
          duration,
          price,
          description: description || null,
          image_url: image_url || null,
          is_active: true,
          created_at: FieldValue.serverTimestamp()
        });

        transaction.update(bizRef, {
          usage_services: FieldValue.increment(1)
        });

        return newServiceRef.id;
      });

      res.json({ success: true, id: result });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/services/:id", express.json(), authenticateUser, async (req: any, res) => {
    try {
      const { businessId, name, duration, price, description, image_url } = req.body;
      const { id } = req.params;
      const uid = req.user.uid;

      const bizDoc = await adminDb.collection("businesses").doc(businessId).get();
      if (!bizDoc.exists || bizDoc.data().owner_id !== uid) return res.status(403).json({ error: "Sem permissão" });

      const serviceRef = adminDb.collection("services").doc(id);
      const updateData: any = { name, duration, price, description: description || null };
      if (image_url) updateData.image_url = image_url;

      await serviceRef.update(updateData);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/services/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { businessId } = req.query;
      const uid = req.user.uid;

      if (!businessId) return res.status(400).json({ error: "businessId required" });

      await adminDb.runTransaction(async (transaction: any) => {
        const bizRef = adminDb.collection("businesses").doc(businessId as string);
        const bizDoc = await transaction.get(bizRef);
        if (!bizDoc.exists || bizDoc.data().owner_id !== uid) throw new Error("Sem permissão");

        const serviceRef = adminDb.collection("services").doc(id);
        transaction.delete(serviceRef);

        transaction.update(bizRef, {
          usage_services: FieldValue.increment(-1)
        });
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/book", express.json(), async (req, res) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ipStr = Array.isArray(rawIp) ? rawIp[0] : rawIp as string;
    const ipHash = crypto.createHash('sha256').update(ipStr).digest('hex');

    try {
      const {
        businessId,
        serviceId,
        professionalId,
        selectedDate,
        selectedTime,
        customerName,
        customerPhone,
        recurrence,
        paymentMethod = 'on_site',
        additionalServiceIds = [],
        idempotencyKey,
        cfTurnstileToken
      } = req.body;

      if (!businessId || !professionalId || !selectedDate || !selectedTime || !serviceId) {
        return res.status(400).json({ error: "Dados incompletos. Verifique e tente novamente." });
      }

      // 1. Bot Protection (Cloudflare Turnstile)
      if (process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY.trim() !== "") {
        if (!cfTurnstileToken) {
           await logSecurityEvent("invalid_bot_token", ipHash, businessId, "unknown", "Missing Turnstile token");
           return res.status(403).json({ error: "Falha na verificação de segurança (Anti-Spam). Recarregue a página." });
        }
        const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: cfTurnstileToken,
          remoteip: ipStr
        });
        if (!verifyRes.data.success) {
           await logSecurityEvent("invalid_bot_token", ipHash, businessId, "unknown", "Invalid Turnstile token");
           return res.status(403).json({ error: "Falha na verificação de segurança (Anti-Spam). Recarregue a página." });
        }
      } else if (!cfTurnstileToken && req.headers['x-bypass-bot'] !== 'true_for_test') { // fallback se nao configurado mas mandamos
         await logSecurityEvent("invalid_bot_token", ipHash, businessId, "unknown", "Missing Turnstile token (dev mode)");
         return res.status(403).json({ error: "Verificação Anti-Spam pendente. Recarregue a página." });
      }

      // 2. Normalization & Validation
      const cleanPhone = (customerPhone || "").replace(/\D/g, '');
      const cleanName = (customerName || "").trim();
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) return res.status(400).json({ error: "Por favor, informe um WhatsApp válido com DDD." });
      if (cleanName.length < 3 || cleanName.length > 100) return res.status(400).json({ error: "Por favor, informe seu nome completo válido." });

      const phoneHash = crypto.createHash('sha256').update(cleanPhone).digest('hex');

      // Check dates in the past
      const aptDate = new Date(`${selectedDate}T${selectedTime}:00`);
      if (aptDate < new Date()) {
         // allow 5 min buffer
         if (new Date().getTime() - aptDate.getTime() > 5 * 60000) {
           return res.status(400).json({ error: "Não é possível agendar em um horário no passado." });
         }
      }

      // 3. Security Limits / Anti-Spam
      const now = new Date();
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const ipQuery = await adminDb.collection("booking_attempts")
        .where("ipHash", "==", ipHash)
        .where("businessId", "==", businessId)
        .where("createdAt", ">", tenMinsAgo)
        .get();
      if (ipQuery.size >= 5) {
        await logSecurityEvent("rate_limit_exceeded", ipHash, businessId, phoneHash, "IP exceeded 5 attempts in 10m");
        return res.status(429).json({ error: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos." });
      }

      const phoneQuery = await adminDb.collection("booking_attempts")
        .where("phoneHash", "==", phoneHash)
        .where("businessId", "==", businessId)
        .where("createdAt", ">", twentyFourHoursAgo)
        .get();
      if (phoneQuery.size >= 3) {
        await logSecurityEvent("suspicious_booking_pattern", ipHash, businessId, phoneHash, "Phone exceeded 3 attempts in 24h");
        return res.status(429).json({ error: "Muitas tentativas para este número. Tente novamente amanhã." });
      }

      // Idempotency
      const generatedIdempotencyKey = idempotencyKey || crypto.createHash('sha256').update(`${businessId}_${serviceId}_${professionalId}_${selectedDate}_${selectedTime}_${cleanPhone}`).digest('hex');
      const idemQuery = await adminDb.collection("booking_attempts").where("idempotencyKey", "==", generatedIdempotencyKey).limit(1).get();
      if (!idemQuery.empty) {
        const attempt = idemQuery.docs[0].data();
        fs.appendFileSync('audit_logs.txt', `Found existing idempotency key! ${generatedIdempotencyKey} attempt: ${JSON.stringify(attempt)}\n`);
        if (attempt.status === "success") {
           return res.json({ success: true, isOnlinePayment: attempt.isOnlinePayment, appointmentId: attempt.appointmentId, recovered: true });
        } else if (attempt.status === "pending") {
           return res.status(409).json({ error: "Seu agendamento já está sendo processado. Aguarde um momento." });
        }
      }

      const attemptRef = adminDb.collection("booking_attempts").doc();
      await attemptRef.set({
        idempotencyKey: generatedIdempotencyKey,
        businessId,
        ipHash,
        phoneHash,
        status: "pending",
        createdAt: FieldValue.serverTimestamp()
      });

      // 4. Fetch definitions explicitly using Admin SDK
      const bizDoc = await adminDb.collection("businesses").doc(businessId).get();
      if (!bizDoc.exists) {
         await attemptRef.update({ status: "failed" });
         return res.status(400).json({ error: "Estabelecimento não encontrado." });
      }
      const bizData = bizDoc.data()!;
      if (['suspended', 'canceled', 'blocked'].includes(bizData.status)) {
         await attemptRef.update({ status: "failed" });
         return res.status(403).json({ error: "Estabelecimento indisponível no momento." });
      }

      const serviceDoc = await adminDb.collection("services").doc(serviceId).get();
      if (!serviceDoc.exists || serviceDoc.data()!.business_id !== businessId) {
         await attemptRef.update({ status: "failed" });
         return res.status(400).json({ error: "Serviço inválido para este estabelecimento." });
      }
      const serviceData = serviceDoc.data()!;

      const profDoc = await adminDb.collection("professionals").doc(professionalId).get();
      if (!profDoc.exists || profDoc.data()!.business_id !== businessId) {
         await attemptRef.update({ status: "failed" });
         return res.status(400).json({ error: "Profissional inválido para este estabelecimento." });
      }

      let extraDuration = 0;
      let extraPrice = 0;
      if (additionalServiceIds.length > 0) {
        for (const extraId of additionalServiceIds) {
           const extDoc = await adminDb.collection("services").doc(extraId).get();
           if (extDoc.exists && extDoc.data()!.business_id === businessId) {
               const extData = extDoc.data()!;
               extraDuration += (extData.duration || extData.duration_minutes || 0);
               extraPrice += Number(extData.price || 0);
           }
        }
      }

      const mainDuration = serviceData.duration || serviceData.duration_minutes || 30;
      const totalDuration = Number(mainDuration) + Number(extraDuration);
      
      const mainPrice = Number(serviceData.price || 0);
      const totalPrice = mainPrice + extraPrice;

      // Ensure start time is in format HH:mm
      const baseTimeStr = selectedTime.substring(0, 5);
      const [sh, sm] = baseTimeStr.split(":").map(Number);
      const endMins = sh * 60 + sm + totalDuration;
      const [eh, em] = [Math.floor(endMins/60), endMins % 60];
      const endTimeStr = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`;

      const clientId = `${businessId}_${cleanPhone}`;
      
      const datesToSchedule = [selectedDate];
      if (recurrence && recurrence !== 'none') {
         const d = new Date(selectedDate);
         for(let i=1; i<4; i++) {
            if(recurrence === 'weekly') d.setDate(d.getDate() + 7);
            if(recurrence === 'biweekly') d.setDate(d.getDate() + 14);
            if(recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
            datesToSchedule.push(d.toISOString().split('T')[0]);
         }
      }

      let firstResult: any = null;

      for (const targetDateStr of datesToSchedule) {
         const dailyScheduleRef = adminDb.collection("daily_schedules").doc(`${businessId}_${professionalId}_${targetDateStr}`);
         
         const startTimeStr = baseTimeStr + ":00";
         const slotId = `${businessId}_${professionalId}_${targetDateStr.replace(/-/g, "")}_${startTimeStr.replace(/:/g, "")}`;
         const aptRef = adminDb.collection("appointments").doc(slotId);

         const legacySnap = await adminDb.collection("appointments")
            .where("business_id", "==", businessId)
            .where("professional_id", "==", professionalId)
            .where("appointment_date", "==", targetDateStr)
            .where("status", "not-in", ["cancelled", "rejected"])
            .get();
         const legacyAppointments = legacySnap.docs.map(d => ({ id: d.id, ...d.data() }));

         const txnResult = await adminDb.runTransaction(async (transaction) => {
            const bizRef = adminDb.collection("businesses").doc(businessId);
            const clientRef = adminDb.collection("clients").doc(clientId);

            const scheduleDoc = await transaction.get(dailyScheduleRef);
            const clientSnap = await transaction.get(clientRef);
            const aptSnap = await transaction.get(aptRef);

            const aptData = aptSnap.data() || {};
            // EXACT MATCH ID CHECK
            if (aptSnap.exists && aptData.status !== 'cancelled') {
               if (aptData.client_id === clientId) {
                  return { aptId: slotId, isOnlinePayment: aptData.payment_timing !== 'on_site', alreadyExists: true };
               }
               throw new Error("Este horário acabou de ser reservado. Escolha outro.");
            }

            // SCHEDULE BUFFER MATCH
            let appointments: any[] = [];
            if (scheduleDoc.exists) appointments = scheduleDoc.data()?.appointments || [];

            legacyAppointments.forEach(legApt => {
              if (!appointments.some(a => a.id === legApt.id)) {
                appointments.push(legApt);
              }
            });

            const timeToMins = (t: string) => { const [h,m] = t.substring(0,5).split(':').map(Number); return h*60 + m; };
            const reqStart = timeToMins(startTimeStr);
            const reqEnd = timeToMins(endTimeStr);

            const conflict = appointments.find((existing: any) => {
               if (existing.status === "cancelled" || existing.status === "rejected") return false;
               const exStart = timeToMins(existing.start_time);
               const exEnd = timeToMins(existing.end_time || (exStart + 30).toString());
               return reqStart < exEnd && reqEnd > exStart;
            });

            if (conflict) {
               if (conflict.client_id === clientId) return { aptId: conflict.id || slotId, isOnlinePayment: conflict.payment_timing !== 'on_site', alreadyExists: true };
               throw new Error("Este horário acabou de ser reservado. Escolha outro.");
            }

            let isNewClient = false;
            if (!clientSnap.exists) {
               transaction.set(clientRef, {
                 business_id: businessId,
                 name: cleanName,
                 phone: cleanPhone,
                 created_at: FieldValue.serverTimestamp(),
                 updated_at: FieldValue.serverTimestamp(),
                 appointments_count: 1,
                 total_revenue: totalPrice,
                 last_appointment_date: FieldValue.serverTimestamp()
               });
               isNewClient = true;
            } else {
               transaction.update(clientRef, {
                 name: cleanName, 
                 updated_at: FieldValue.serverTimestamp(),
                 appointments_count: FieldValue.increment(1),
                 total_revenue: FieldValue.increment(totalPrice),
                 last_appointment_date: FieldValue.serverTimestamp()
               });
            }

            appointments.push({
              id: slotId,
              start_time: startTimeStr,
              end_time: endTimeStr,
              client_id: clientId
            });
            transaction.set(dailyScheduleRef, { appointments }, { merge: true });

            const isOnlinePayment = bizData.enable_payment_setup && paymentMethod !== 'on_site';
            const initialStatus = isOnlinePayment ? "pending_payment" : (bizData.auto_confirm ? "confirmed" : "pending");

            transaction.set(aptRef, {
               business_id: businessId,
               client_id: clientId,
               professional_id: professionalId,
               service_id: serviceId,
               additional_service_ids: additionalServiceIds,
               appointment_date: targetDateStr,
               start_time: startTimeStr,
               end_time: endTimeStr,
               status: initialStatus,
               recurrence_type: recurrence || null,
               payment_status: "unpaid",
               payment_timing: paymentMethod || 'on_site',
               total_price: totalPrice,
               client_name: cleanName,
               client_phone: cleanPhone,
               service_name_snapshot: serviceData.name + (additionalServiceIds.length ? ` (+${additionalServiceIds.length})` : ''),
               source: "backend_api_v3",
               created_at: FieldValue.serverTimestamp(),
               updated_at: FieldValue.serverTimestamp()
            });

            if (isNewClient) {
               transaction.update(bizRef, { usage_appointments: FieldValue.increment(1), usage_clients: FieldValue.increment(1) });
            } else {
               transaction.update(bizRef, { usage_appointments: FieldValue.increment(1) });
            }
            
            return { aptId: slotId, isOnlinePayment };
         });

         if (!firstResult && txnResult && !txnResult.skip) {
             firstResult = txnResult;
         }

         if (txnResult && !txnResult.skip && !txnResult.alreadyExists) {
             await adminDb.collection("processing_queue").add({
                 type: "sync_appointment_effects",
                 businessId,
                 payload: { aptId: txnResult.aptId, paymentTiming: paymentMethod, isOnlinePayment: txnResult.isOnlinePayment },
                 status: "pending",
                 created_at: FieldValue.serverTimestamp(),
                 updated_at: FieldValue.serverTimestamp(),
                 attempts: 0
             });
         }
      }

      if (!firstResult) throw new Error("Não foi possível criar nenhum agendamento.");

      await attemptRef.update({
        status: "success",
        appointmentId: firstResult.aptId,
        isOnlinePayment: firstResult.isOnlinePayment
      });

      const safeData = { business_id: businessId, type: firstResult.isOnlinePayment ? "pending_payment" : "confirmed" };
      await adminDb.collection("system_events").add({
        level: "info",
        event: "booking_created",
        type: "conversion",
        user_id: "system",
        business_id: businessId,
        status: "success",
        metadata: safeData,
        created_at: FieldValue.serverTimestamp()
      });

      res.json({ success: true, isOnlinePayment: firstResult.isOnlinePayment, appointmentId: firstResult.aptId });

    } catch (error: any) {
      console.error("[API_BOOK] Error:", error);
      res.status(500).json({ error: error.message || "Booking failed" });
    }
  });

  app.post("/api/suggest-style", async (req, res) => {
    try {
      const { businessId, imageUrl, galleryStyles } = req.body;
      if (!imageUrl || !businessId) return res.status(400).json({ error: "Image and businessId required" });
      
      const snap = await adminDb.collection("businesses").doc(businessId).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Barbearia não encontrada." });
      }

      const bizData = snap.data();
      const plan = (bizData.plan_id || "FREE").toUpperCase();
      const status = bizData.subscription_status || "active";
      
      if (plan !== "PREMIUM" || status !== "active") {
        return res.status(403).json({ 
          error: "Acesso bloqueado", 
          debug: { plan, status, businessId, bizData },
          reason: status !== "active" ? "Assinatura inativa ou com problemas de pagamento." : "Funcionalidade disponível apenas no plano Premium." 
        });
      }

      const prompt = `Analise a foto do rosto do cliente e sugira qual dos nossos estilos de corte combinaria melhor com ele, baseando-se no formato do rosto e características faciais. Sugira também combinações de serviços complementares (como barba, sobrancelha, ou produtos). Nossos estilos são: ${JSON.stringify(galleryStyles)}.`;
      
      const base64Data = imageUrl.split(",")[1];
      const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt },
          ],
        },
      });

      res.json({ suggestion: response.text });
    } catch (error: unknown) {
      console.error(error);
      const e = error as Error;
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/simulate-style", async (req, res) => {
    try {
      const { businessId, imageUrl, styleDescription } = req.body;
      if (!imageUrl || !businessId) return res.status(400).json({ error: "Image and businessId required" });

      const snap = await adminDb.collection("businesses").doc(businessId).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Barbearia não encontrada." });
      }

      const bizData = snap.data();
      const plan = (bizData.plan_id || "FREE").toUpperCase();
      const status = bizData.subscription_status || "active";
      
      if (plan !== "PREMIUM" || status !== "active") {
        return res.status(403).json({ 
          error: "Acesso bloqueado", 
          reason: status !== "active" ? "Assinatura inativa ou com problemas de pagamento." : "Funcionalidade disponível apenas no plano Premium." 
        });
      }

      const prompt = `Ajuste o cabelo desta pessoa para aplicar este estilo/corte: "${styleDescription}". Faça isso adaptando o corte para as características faciais do cliente para o resultado mais realista possível no rosto do cliente.`;
      
      const base64Data = imageUrl.split(",")[1];
      const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt },
          ],
        },
      });

      let generatedImage = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          generatedImage = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break; // Use the first image we find
        }
      }

      if (!generatedImage) throw new Error("Não foi possível gerar a simulação");

      // Now generate a description for it using Gemini 3.1 Pro
      const descResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Escreva um breve parágrafo recomendando este estilo simulado, serviços complementares da barbearia, e uma dica de produto relacionado para manutenção. O estilo pedido foi: ${styleDescription}`
      });

      res.json({ 
        generatedImage, 
        description: descResponse.text 
      });
    } catch (error: unknown) {
      console.error(error);
      const e = error as Error;
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const { priceId, successUrl, cancelUrl, customerEmail, businessId, planId, discountCode } = req.body;
      if (!priceId) return res.status(400).json({ error: "Price ID is required" });

      const priceToPlan: Record<string, string> = {};
      if (process.env.STRIPE_PRICE_PRO_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_PRO_MONTHLY] = 'PRO';
      if (process.env.STRIPE_PRICE_BUSINESS_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_BUSINESS_MONTHLY] = 'BUSINESS';
      if (process.env.STRIPE_PRICE_PREMIUM_MONTHLY) priceToPlan[process.env.STRIPE_PRICE_PREMIUM_MONTHLY] = 'PREMIUM';
      if (process.env.STRIPE_PRICE_PRO_YEARLY) priceToPlan[process.env.STRIPE_PRICE_PRO_YEARLY] = 'PRO';
      if (process.env.STRIPE_PRICE_BUSINESS_YEARLY) priceToPlan[process.env.STRIPE_PRICE_BUSINESS_YEARLY] = 'BUSINESS';
      if (process.env.STRIPE_PRICE_PREMIUM_YEARLY) priceToPlan[process.env.STRIPE_PRICE_PREMIUM_YEARLY] = 'PREMIUM';
      
      // Add default mock items to fallback during dev if env isn't defined yet
      priceToPlan['price_pro_monthly'] = 'PRO';
      priceToPlan['price_business_monthly'] = 'BUSINESS';
      priceToPlan['price_premium_monthly'] = 'PREMIUM';

      let validatedPlanId = priceToPlan[priceId];

      if (!validatedPlanId) {
         if (process.env.NODE_ENV === 'production') {
            return res.status(400).json({ error: "Invalid Price ID" });
         } else {
            validatedPlanId = planId; // Allow arbitrary mapping only in dev
         }
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        client_reference_id: businessId,
        metadata: {
          businessId,
          planId: validatedPlanId
        }
      };

      if (discountCode) {
        // Assume discountCode corresponds to a Stripe Coupon ID
        sessionParams.discounts = [{ coupon: discountCode }];
      } else {
        // Otherwise, allow users to insert a promotion code directly on the Stripe checkout page
        sessionParams.allow_promotion_codes = true;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.json({ url: session.url });
    } catch (error: unknown) {
      const e = error as Error;
      res.status(500).json({ error: e.message });
    }
  });

  // --- INSTAGRAM INTEGRATION ---
  
  const INSTAGRAM_CLIENT_ID = process.env.VITE_INSTAGRAM_CLIENT_ID;
  const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;

  // Utility function for redirect URI
  const getRedirectUri = (req: any) => {
    const defaultUrl = process.env.APP_URL;
    if (defaultUrl) return `${defaultUrl}/auth/instagram/callback`;
    
    // Fallback if APP_URL is somehow missing
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    return `${protocol}://${host}/auth/instagram/callback`;
  };

  app.get("/api/auth/instagram/url", (req, res) => {
    const REDIRECT_URI = getRedirectUri(req);
    
    if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
      return res.status(500).json({ error: "O aplicativo não possui as credenciais do Instagram (Secrets VITE_INSTAGRAM_CLIENT_ID e INSTAGRAM_CLIENT_SECRET)." });
    }
    
    const url = `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user_profile,user_media&response_type=code`;
    res.json({ url });
  });

  app.get("/auth/instagram/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    const REDIRECT_URI = getRedirectUri(req);

    try {
      let long_lived_token = "";
      let user_id = "";
      let expires_in = 5184000;

      // 1. Exchange code for short-lived token
      const tokenResponse = await axios.post("https://api.instagram.com/oauth/access_token", new URLSearchParams({
        client_id: INSTAGRAM_CLIENT_ID!,
        client_secret: INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code: code as string,
      }));

      const { access_token } = tokenResponse.data;
      user_id = tokenResponse.data.user_id;

      // 2. Exchange for long-lived token (60 days)
      const longLivedResponse = await axios.get(`https://graph.instagram.com/access_token`, {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: INSTAGRAM_CLIENT_SECRET,
          access_token
        }
      });

      long_lived_token = longLivedResponse.data.access_token;
      expires_in = longLivedResponse.data.expires_in;

      // In a real app, we would associate this with the logged-in user's business
      // For this demo/container setup, we return a success page that sends the token back
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: white;">
            <div style="text-align: center;">
              <h2 style="color: #7c3aed;">Instagram Conectado!</h2>
              <p>Sincronizando seus posts...</p>
              <script>
                window.opener.postMessage({ 
                  type: 'INSTAGRAM_AUTH_SUCCESS', 
                  payload: { 
                    access_token: "${long_lived_token}", 
                    user_id: "${user_id}",
                    expires_at: ${Date.now() + (expires_in * 1000)}
                  } 
                }, '*');
                setTimeout(() => window.close(), 2000);
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: unknown) {
      const axiosError = error as any;
      if (axiosError.response?.data?.error?.type === 'OAuthException' || axiosError.response?.data?.error_type === 'OAuthException') {
        console.warn("Instagram Auth Warning:", axiosError.response?.data?.error_message || axiosError.response?.data);
      } else {
        console.error("Instagram Auth Error:", axiosError.response?.data || axiosError.message);
      }
      res.status(500).send("Erro na autenticação com Instagram");
    }
  });

  app.get("/api/instagram/sync", async (req, res) => {
    const { accessToken, businessId } = req.query;
    if (!accessToken || !businessId) return res.status(400).json({ error: "Missing params" });

    try {
      const response = await axios.get(`https://graph.instagram.com/me/media`, {
        params: {
          fields: "id,caption,media_type,media_url,permalink,timestamp",
          access_token: accessToken,
          limit: 12
        }
      });

      res.json(response.data.data);
    } catch (error: unknown) {
      const axiosError = error as any;
      const responseData = axiosError.response?.data;
      if (responseData?.error?.type === 'OAuthException') {
        console.warn("Instagram OAuth/Sessão expirada:", responseData.error.message || responseData.error);
        return res.status(401).json({ error: "Sessão expirada. Reconecte seu Instagram.", details: responseData });
      }

      console.error("Instagram Sync Error:", responseData || axiosError.message);
      res.status(500).json({ error: "Erro ao sincronizar posts" });
    }
  });

  // Vite middleware for development
  let vite: { [key: string]: any };
  if (process.env.NODE_ENV !== "production") {
    const v = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa", // Voltar para SPA para maior estabilidade
    });
    vite = v as any;
    
    // Middleware customizado para interceptar a requisição de HTML e injetar SEO
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      
      // Só interceptar se for uma navegação (HTML) e não um asset
      const isHtmlRequest = req.headers.accept?.includes("text/html") || (!url.includes(".") && !url.startsWith("/api/") && !url.startsWith("/@") && !url.startsWith("/node_modules/"));

      if (isHtmlRequest) {
        try {
          const templatePath = path.resolve(__dirname, "index.html");
          let template = fs.readFileSync(templatePath, "utf-8");
          template = await vite.transformIndexHtml(url, template);

          // Lógica de SEO (Mesma de antes)
          let seo = { title: "App Agendamento", description: "Agende seu horário online", schemaMarkup: null };
          const parts = url.split('/').filter(p => p);
          if (parts.length >= 1) {
            const bizSlug = parts[0];
            const biz = (mockBusinessData as any)[bizSlug];
            if (biz) {
              if (parts.length === 2) {
                seo = generateAutoSEO('service', { businessName: biz.name, serviceName: "Corte de Cabelo", city: biz.city, slug: `${bizSlug}/${parts[1]}` }, biz.plan || 'FREE');
              } else {
                seo = generateAutoSEO('business', { businessName: biz.name, city: biz.city, slug: bizSlug }, biz.plan || 'FREE');
              }
            } else if (parts[0] === 'cidade' && parts.length === 3) {
               seo = generateAutoSEO('location-service', { businessName: "Rede de Agendamento", serviceName: parts[2], city: parts[1], slug: `cidade/${parts[1]}/${parts[2]}` }, 'PREMIUM');
            }
          }

          const escape = (str: string) => str.replace(/"/g, "&quot;");
          let html = template;
          html = html.replace(/<title>.*?<\/title>/, `<title>${seo.title}</title>`);
          
          const isFlowzaApp = url === '/' || url === '/auth' || url.startsWith('/dashboard') || url.startsWith('/client');
          if (!isFlowzaApp) {
            html = html.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');
          }

          const metaTags = `
            <meta name="description" content="${escape(seo.description)}">
            <meta property="og:title" content="${escape(seo.title)}">
            <meta property="og:description" content="${escape(seo.description)}">
            <meta name="twitter:card" content="summary_large_image">
            <link rel="canonical" href="https://ais-dev.run.app${url}">
            ${seo.schemaMarkup ? `<script type="application/ld+json">${JSON.stringify(seo.schemaMarkup)}</script>` : ''}
          `;
          html = html.replace("</head>", `${metaTags}</head>`);
          
          return res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch (e) {
          console.error("Erro no middleware de SEO:", e);
          next(); // Fallback para o comportamento padrão do Vite
        }
      } else {
        next();
      }
    });

    app.use(vite.middlewares);
  } else {
    // Produção
    app.use(express.static(path.join(__dirname, "dist"), { index: false }));
    
    app.get("*", (req, res) => {
      const templatePath = path.resolve(__dirname, "dist/index.html");
      let template = fs.readFileSync(templatePath, "utf-8");
      
      const url = req.originalUrl;
      const isFlowzaApp = url === '/' || url === '/auth' || url.startsWith('/dashboard') || url.startsWith('/client');
      
      if (!isFlowzaApp) {
        template = template.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');
      }

      // Mínimo de SEO para produção sem re-processar tudo se não quiser
      res.send(template);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
