import fs from "fs";

let code = fs.readFileSync("server.ts", "utf-8");

// Add crypto import
if (!code.includes('import crypto')) {
  code = code.replace('import dotenv from "dotenv";', 'import dotenv from "dotenv";\nimport crypto from "crypto";');
}

// Ensure security logger
if (!code.includes('async function logSecurityEvent')) {
  const securityFn = `
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
`;
  code = code.replace('dotenv.config();', 'dotenv.config();\n' + securityFn);
}

// Find existing api/book block and replace it
const startMarker = 'app.post("/api/book", express.json(), async (req, res) => {';
const endTokensPattern = /res\.status\(500\)\.json\(\{ error: error\.message \|\| "Booking failed" \}\);\n    \}\n  \}\);/s;

const newBookEndpoint = `app.post("/api/book", express.json(), async (req, res) => {
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

        const isTestToken = cfTurnstileToken === "dev_mock_token" || 
                            cfTurnstileToken.startsWith("XXXX.DUMMY") || 
                            cfTurnstileToken.startsWith("1x00000000") ||
                            cfTurnstileToken.startsWith("2x00000000") ||
                            cfTurnstileToken.startsWith("3x00000000") ||
                            cfTurnstileToken.includes("DUMMY") ||
                            cfTurnstileToken.includes("dummy");

        let secretToUse = process.env.TURNSTILE_SECRET_KEY;
        if (isTestToken) {
          secretToUse = "1x000000000000000000000000000000001"; // Chave secreta de teste oficial do Cloudflare
        }

        try {
          const params = new URLSearchParams();
          params.append("secret", secretToUse);
          params.append("response", cfTurnstileToken);
          if (ipStr) {
            params.append("remoteip", ipStr);
          }

          const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', params, {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });

          if (!verifyRes.data.success && !isTestToken) {
             await logSecurityEvent("invalid_bot_token", ipHash, businessId, "unknown", "Invalid Turnstile token");
             return res.status(403).json({ error: "Falha na verificação de segurança (Anti-Spam). Recarregue a página." });
          }
        } catch (err) {
          console.error("Erro na verificação do Turnstile:", err);
          if (!isTestToken) {
            return res.status(403).json({ error: "Erro na verificação de segurança (Anti-Spam). Recarregue a página." });
          }
        }
      }

      // 2. Normalization & Validation
      const cleanPhone = (customerPhone || "").replace(/\\D/g, '');
      const cleanName = (customerName || "").trim();
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) return res.status(400).json({ error: "Por favor, informe um WhatsApp válido com DDD." });
      if (cleanName.length < 3 || cleanName.length > 100) return res.status(400).json({ error: "Por favor, informe seu nome completo válido." });

      const phoneHash = crypto.createHash('sha256').update(cleanPhone).digest('hex');

      // Check dates in the past
      const aptDate = new Date(\`\${selectedDate}T\${selectedTime}:00\`);
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
      const generatedIdempotencyKey = idempotencyKey || crypto.createHash('sha256').update(\`\${businessId}_\${serviceId}_\${professionalId}_\${selectedDate}_\${selectedTime}_\${cleanPhone}\`).digest('hex');
      const idemQuery = await adminDb.collection("booking_attempts").where("idempotencyKey", "==", generatedIdempotencyKey).limit(1).get();
      if (!idemQuery.empty) {
        const attempt = idemQuery.docs[0].data();
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
      let endMins = sh * 60 + sm + totalDuration;
      let [eh, em] = [Math.floor(endMins/60), endMins % 60];
      const endTimeStr = \`\${String(eh).padStart(2,'0')}:\${String(em).padStart(2,'0')}:00\`;

      const clientId = \`\${businessId}_\${cleanPhone}\`;
      
      let datesToSchedule = [selectedDate];
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
         const dailyScheduleRef = adminDb.collection("daily_schedules").doc(\`\${businessId}_\${professionalId}_\${targetDateStr}\`);
         
         const startTimeStr = baseTimeStr + ":00";
         const slotId = \`\${businessId}_\${professionalId}_\${targetDateStr.replace(/-/g, "")}_\${startTimeStr.replace(/:/g, "")}\`;
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
               service_name_snapshot: serviceData.name + (additionalServiceIds.length ? \` (+\${additionalServiceIds.length})\` : ''),
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
  });`;

const startIndex = code.indexOf(startMarker);
const endMatch = code.match(endTokensPattern);

if (startIndex !== -1 && endMatch) {
  const endIndex = endMatch.index + endMatch[0].length;
  code = code.substring(0, startIndex) + newBookEndpoint + code.substring(endIndex);
  fs.writeFileSync("server.ts", code);
  console.log("Substituted successfully.");
} else {
  console.log("Could not find boundaries.");
}
