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
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
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
  app.post("/api/suggest-style", async (req, res) => {
    try {
      const { imageUrl, galleryStyles } = req.body;
      if (!imageUrl) return res.status(400).json({ error: "Image required" });
      
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
      const { imageUrl, styleDescription } = req.body;
      if (!imageUrl) return res.status(400).json({ error: "Image required" });

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
      const { priceId, successUrl, cancelUrl, customerEmail } = req.body;
      if (!priceId) return res.status(400).json({ error: "Price ID is required" });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
      });

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
    if (!INSTAGRAM_CLIENT_ID) {
      return res.status(500).json({ error: "Para conectar seu Instagram real, você precisa configurar as variáveis VITE_INSTAGRAM_CLIENT_ID e INSTAGRAM_CLIENT_SECRET no menu de Secrets (Segredos) desta plataforma." });
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
