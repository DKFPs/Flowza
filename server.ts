import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { generateAutoSEO } from "./src/services/seoService.ts";
import axios from "axios";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc, runTransaction, increment, limit } from 'firebase/firestore';
import * as Sentry from "@sentry/node";

dotenv.config();

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
    await addDoc(collection(db, "system_events"), {
      level,
      event,
      type,
      user_id: "system",
      business_id: metadata?.business_id || "system",
      status: level === "error" ? "failure" : "success",
      metadata: safeData,
      created_at: serverTimestamp()
    });

    if (level === "error") {
      Sentry.captureException(new Error(event), { extra: metadata });
    }
  } catch (err) {
    console.error("Failed to track server event", err);
  }
}

// Background Worker: MÓDULO 3 — FILA DE PROCESSAMENTO (WHATSAPP)
function startQueueWorker() {
  console.log("[WORKER] Background queue processor started...");
  setInterval(async () => {
    try {
      const q = query(collection(db, "notification_queue"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      
      snap.forEach(async (document) => {
        const data = document.data();
        const docRef = doc(db, "notification_queue", document.id);
        
        try {
          const bizSnap = await getDocs(query(collection(db, "businesses"), where("__name__", "==", data.business_id || "unknown"), limit(1)));
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
          
          await updateDoc(docRef, {
            status: "sent",
            sent_at: serverTimestamp()
          });
          console.log(`[WORKER] Successfully sent WhatsApp for ${data.payload?.client_name || 'Client'} (APT: ${data.appointment_id})`);
          
          await trackServerEvent("info", "whatsapp_sent_success", "integration", { appointment_id: data.appointment_id });

        } catch (error) {
          const retries = (data.retry_count || 0) + 1;
          const msg = error instanceof Error ? error.message : "Unknown error";
          console.warn(`[WORKER] Failed to send WhatsApp for ${document.id}. Retry: ${retries}`);
          
          await updateDoc(docRef, {
            status: retries >= 3 ? "failed" : "pending",
            retry_count: retries,
            last_error: msg,
            updated_at: serverTimestamp(),
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
    } catch (e) {
      console.error("[WORKER] Error processing queue:", e);
      // Módulo 1/7: Report Worker Error
      trackServerEvent("error", "worker_loop_failure", "system", { error: e instanceof Error ? e.message : String(e) });
    }
  }, 10000); // Check every 10 seconds
}

startQueueWorker();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
             const businessRef = doc(db, 'businesses', businessId);
             
             const updateData: any = {
                subscription_status: 'active',
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
             };
             
             if (planId) {
                updateData.plan_id = planId;
             }

             await updateDoc(businessRef, updateData);
             
             // Cria documento na coleção subscriptions como pedido
             const subRef = doc(db, 'subscriptions', businessId);
             await addDoc(collection(db, 'subscriptions'), {
                business_id: businessId,
                plan_id: planId || "FREE",
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                status: 'active',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
             });

             await trackServerEvent("info", "subscription_activated", "billing", { business_id: businessId, plan_id: planId, customer_id: session.customer });
          }
          break;
        }
        case 'customer.subscription.updated': {
           const subscription = event.data.object;
           // Find business by customer ID and update billing status
           const qQuery = query(collection(db, 'businesses'), where('stripe_customer_id', '==', subscription.customer));
           const snap = await getDocs(qQuery);
           if (!snap.empty) {
             const businessId = snap.docs[0].id;
             const businessRef = doc(db, 'businesses', businessId);
             await updateDoc(businessRef, {
               subscription_status: subscription.status,
             });
             
             const subQ = query(collection(db, 'subscriptions'), where('stripe_subscription_id', '==', subscription.id));
             const subSnap = await getDocs(subQ);
             if (!subSnap.empty) {
               await updateDoc(doc(db, 'subscriptions', subSnap.docs[0].id), {
                 status: subscription.status,
                 updated_at: serverTimestamp()
               });
             }
           }
           break;
        }
        case 'customer.subscription.deleted': {
           const subscription = event.data.object;
           const qQuery = query(collection(db, 'businesses'), where('stripe_customer_id', '==', subscription.customer));
           const snap = await getDocs(qQuery);
           if (!snap.empty) {
             const businessId = snap.docs[0].id;
             const businessRef = doc(db, 'businesses', businessId);
             await updateDoc(businessRef, {
               subscription_status: 'canceled',
               plan_id: 'FREE'
             });
             
             const subQ = query(collection(db, 'subscriptions'), where('stripe_subscription_id', '==', subscription.id));
             const subSnap = await getDocs(subQ);
             if (!subSnap.empty) {
               await updateDoc(doc(db, 'subscriptions', subSnap.docs[0].id), {
                 status: 'canceled',
                 updated_at: serverTimestamp()
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
  
  // --- AI Availability & Validation ---
  app.post("/api/availability", express.json(), async (req, res) => {
    try {
      const { businessId, professionalId, date, duration, checkOnlyTime } = req.body;
      if (!businessId || !professionalId || !date || !duration) {
        return res.status(400).json({ error: "Missing required params" });
      }

      // Fetch professional data for constraints
      const profRef = doc(db, "professionals", professionalId);
      const profSnap = await getDocs(query(collection(db, "professionals"), where("__name__", "==", professionalId), limit(1)));
      const profData = profSnap.empty ? null : profSnap.docs[0].data();
      const buffer = profData?.buffer_minutes || 0;

      // Fetch appointments for that day
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", businessId),
        where("professional_id", "==", professionalId),
        where("appointment_date", "==", date),
        where("status", "!=", "cancelled"),
        limit(50)
      );
      const snap = await getDocs(q);
      const appointments = snap.docs.map(d => d.data());

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

  app.post("/api/book", express.json(), async (req, res) => {
    try {
      const {
        businessId,
        professionalId,
        clientId,
        date,
        time,
        duration,
        serviceId,
        additionalServiceIds = [],
        totalPrice,
        clientData,
        slug
      } = req.body;

      if (!businessId || !professionalId || !date || !time || !duration) {
        return res.status(400).json({ error: "Missing required params" });
      }

      // Check slot validation
      const timeToMins = (t: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':');
          return Number(h) * 60 + Number(m);
      };

      const m = timeToMins(time);
      const slotStart = m;
      const slotEnd = m + duration;

      const endHh = Math.floor(slotEnd / 60).toString().padStart(2, '0');
      const endMm = (slotEnd % 60).toString().padStart(2, '0');
      const endTimeStr = `${endHh}:${endMm}`;

      let appointmentId = "";
      let appointmentData: any = {};

      // Fetch professional data for constraints
      const profSnap = await getDocs(query(collection(db, "professionals"), where("__name__", "==", professionalId), limit(1)));
      const profData = profSnap.empty ? null : profSnap.docs[0].data();
      const buffer = profData?.buffer_minutes || 0;

      // Lock document for the professional's day
      const dailyScheduleRef = doc(db, "daily_schedules", `${businessId}_${professionalId}_${date}`);
      const newAptRef = doc(collection(db, "appointments"));

      // Fetch existing appointments outside the transaction to ensure backwards compatibility
      // with legacy bookings not present in `daily_schedules`.
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", businessId),
        where("professional_id", "==", professionalId),
        where("appointment_date", "==", date),
        where("status", "!=", "cancelled"),
        limit(50)
      );
      const snap = await getDocs(q);
      const legacyAppointments = snap.docs.map(d => d.data());

      await runTransaction(db, async (transaction) => {
          const scheduleDoc = await transaction.get(dailyScheduleRef);
          let appointments: any[] = [];
          
          if (scheduleDoc.exists()) {
             appointments = scheduleDoc.data().appointments || [];
          }

          // Merge legacy appointments correctly
          legacyAppointments.forEach((legApt: any) => {
            if (!appointments.some(a => a.id === legApt.id)) {
              appointments.push({
                id: legApt.id || "legacy",
                start_time: legApt.start_time,
                end_time: legApt.end_time,
                client_id: legApt.client_id || "unknown"
              });
            }
          });

          // Conflict detection using atomic data
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
                  return slotStart < (aptEnd + buffer) && slotEnd > (aptStart - buffer);
              });
          }

          if (hasConflict) {
              throw new Error("Este horário acabou de ser ocupado. Por favor, tente outro.");
          }

          // Fetch business and client
          const bizRef = doc(db, "businesses", businessId);
          const clientRef = doc(db, "clients", clientId);

          const bizDoc = await transaction.get(bizRef);
          if (!bizDoc.exists()) throw new Error("Estabelecimento não encontrado.");
          
          const bizData = bizDoc.data();
          if (slug !== "demo" && bizData.limit_appointments && (bizData.usage_appointments || 0) >= bizData.limit_appointments) {
            throw new Error("Limite de agendamentos atingido para este estabelecimento.");
          }

          const clientSnap = await transaction.get(clientRef);
          if (!clientSnap.exists()) {
            transaction.set(clientRef, {
              business_id: businessId,
              name: clientData?.name || "Cliente",
              phone: clientData?.phone || "",
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });
          } else {
            transaction.update(clientRef, { 
              name: clientData?.name || clientSnap.data().name, 
              updated_at: serverTimestamp()
            });
          }
          
          // If no conflict, append to daily schedule
          appointments.push({
            id: newAptRef.id,
            start_time: time,
            end_time: endTimeStr,
            client_id: clientId || "unknown"
          });

          transaction.set(dailyScheduleRef, { appointments }, { merge: true });

          // Insert Appointment safely
          appointmentData = {
            id: newAptRef.id,
            business_id: businessId,
            client_id: clientId || "walk-in",
            professional_id: professionalId,
            service_id: serviceId,
            additional_service_ids: additionalServiceIds,
            appointment_date: date,
            start_time: time + ":00",
            end_time: endTimeStr + ":00",
            status: "confirmed",
            payment_status: "pending",
            total_price: totalPrice || 0,
            source: "booking_page_v2", // tagged as v2 engine
            created_at: serverTimestamp()
          };

          transaction.set(newAptRef, appointmentData);
          appointmentId = newAptRef.id;
      });

      res.json({ success: true, appointmentId, appointmentData });

    } catch (error: any) {
      console.error("[API_BOOK] Error:", error);
      res.status(500).json({ error: "Booking failed: " + error.message });
    }
  });

  app.post("/api/suggest-style", async (req, res) => {
    try {
      const { businessId, imageUrl, galleryStyles } = req.body;
      if (!imageUrl || !businessId) return res.status(400).json({ error: "Image and businessId required" });
      
      const snap = await getDocs(query(collection(db, "businesses"), where("__name__", "==", businessId), limit(1)));
      if (!snap.empty) {
        const bizData = snap.docs[0].data();
        const plan = bizData.plan_id ? bizData.plan_id.toLowerCase() : "free";
        const hasAI = (plan === "premium"); // AI is Premium only based on requested structure
        if (!hasAI) {
           return res.status(403).json({ error: "Funcionalidade de IA disponível apenas no plano Premium." });
        }
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

      const snap = await getDocs(query(collection(db, "businesses"), where("__name__", "==", businessId), limit(1)));
      if (!snap.empty) {
        const bizData = snap.docs[0].data();
        const plan = bizData.plan_id ? bizData.plan_id.toLowerCase() : "free";
        const hasAI = (plan === "premium"); 
        if (!hasAI) {
           return res.status(403).json({ error: "Funcionalidade de IA disponível apenas no plano Premium." });
        }
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
          planId
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
      // Simulation Mode: Return a mock auth URL on our own server
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const origin = `${protocol}://${host}`;
      console.log(`[INSTAGRAM] Secrets missing. Enabling Simulation Mode via ${origin}/auth/instagram/mock`);
      return res.json({ 
        url: `${origin}/auth/instagram/mock?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
        is_simulation: true 
      });
    }
    
    const url = `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user_profile,user_media&response_type=code`;
    res.json({ url });
  });

  // Simulation Endpoint for Instagram
  app.get("/auth/instagram/mock", (req, res) => {
    const { redirect_uri } = req.query;
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: white; margin: 0;">
          <div style="text-align: center; max-width: 400px; padding: 2rem; border: 1px solid #333; border-radius: 20px; background: #111;">
            <div style="width: 64px; height: 64px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border-radius: 18px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </div>
            <h2 style="color: white; margin-bottom: 0.5rem;">Modo Simulação Flowza</h2>
            <p style="color: #888; font-size: 0.9rem; line-height: 1.5; margin-bottom: 2rem;">
              Você não configurou o Instagram API no menu Secrets. Para fins de demonstração, este simulador irá conectar uma conta fictícia.
            </p>
            <a href="${redirect_uri}?code=MOCK_AUTH_CODE" style="display: block; background: #7c3aed; color: white; text-decoration: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: bold; transition: opacity 0.2s;">
              Autorizar Conta de Teste
            </a>
            <p style="margin-top: 1.5rem; font-size: 0.7rem; color: #555;">
              Para conectar seu Instagram real, volte e configure as variáveis VITE_INSTAGRAM_CLIENT_ID e INSTAGRAM_CLIENT_SECRET.
            </p>
          </div>
        </body>
      </html>
    `);
  });

  app.get("/auth/instagram/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    const REDIRECT_URI = getRedirectUri(req);

    try {
      if (code === "MOCK_AUTH_CODE") {
        // Simulation mode response
        return res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: white;">
              <div style="text-align: center;">
                <h2 style="color: #7c3aed;">Simulação Concluída!</h2>
                <p>Conta de teste conectada com sucesso.</p>
                <script>
                  window.opener.postMessage({ 
                    type: 'INSTAGRAM_AUTH_SUCCESS', 
                    payload: { 
                      access_token: "MOCK_TOKEN_" + Math.random().toString(36).substring(7), 
                      user_id: "mock_user_123",
                      expires_at: ${Date.now() + (60 * 24 * 60 * 60 * 1000)},
                      is_simulation: true
                    } 
                  }, '*');
                  setTimeout(() => window.close(), 2000);
                </script>
              </div>
            </body>
          </html>
        `);
      }

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

    if (String(accessToken).startsWith("MOCK_TOKEN")) {
      // Mock posts for simulation
      const mockPosts = [
        {
          id: "m1",
          caption: "Resultado incrível de hoje! ✨ #barbearia #estilo",
          media_type: "IMAGE",
          media_url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
          permalink: "https://instagram.com",
          timestamp: new Date().toISOString()
        },
        {
          id: "m2",
          caption: "Ambiente renovado para melhor atender você. 💈",
          media_type: "IMAGE",
          media_url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
          permalink: "https://instagram.com",
          timestamp: new Date().toISOString()
        },
        {
          id: "m3",
          caption: "Novos produtos premium chegaram! 🧴",
          media_type: "IMAGE",
          media_url: "https://images.unsplash.com/photo-1621605815971-fbc388062093?w=800&q=80",
          permalink: "https://instagram.com",
          timestamp: new Date().toISOString()
        }
      ];
      return res.json(mockPosts);
    }

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
      const isHtmlRequest = req.headers.accept?.includes("text/html") || (!url.includes(".") && !url.startsWith("/@") && !url.startsWith("/node_modules/"));

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
