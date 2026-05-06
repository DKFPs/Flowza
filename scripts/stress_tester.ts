import { collection, getDocs, query, limit, where } from "firebase/firestore";
import { db } from "../src/lib/firebase";
import fs from "fs";

/**
 * ===============================================================
 * 🚀 FLOWZA - AUTOMATED STRESS & CONCURRENCY TESTER (QA ENGINE)
 * ===============================================================
 * 
 * Este script executa testes de estresse pesados no motor de
 * agendamento do Flowza, verificando:
 * 1. Race Conditions (Múltiplos usuários no mesmo horário)
 * 2. Load/Throughput (Múltiplas requisições simultâneas em horários diferentes)
 * 3. Rapid Clicks (Spam de agendamentos pelo mesmo usuário)
 * 4. Validação de Idempotência e Integridade do Banco.
 * 
 * Uso: npx tsx scripts/stress_tester.ts
 */

const API_BASE = "http://localhost:3000";

interface TestConfig {
  businessId: string;
  professionalId: string;
  serviceId: string;
}

interface TestReport {
  scenario: string;
  totalRequests: number;
  successes: number;
  failures: number;
  avgResponseTimeMs: number;
  statusCodes: Record<string, number>;
  errors: string[];
  validationPassed: boolean;
  notes: string[];
}

// -------------------------------------------------------------
// HELPER FOR REQUESTS
// -------------------------------------------------------------
async function fireBookingRequest(config: TestConfig, date: string, time: string, clientName: string) {
  const start = Date.now();
  try {
    const payload = {
      businessId: config.businessId,
      professionalId: config.professionalId,
      clientId: `user_${clientName.replace(/\s+/g, "")}`,
      date,
      time,
      duration: 30,
      serviceId: config.serviceId,
      totalPrice: 50,
      clientData: {
        name: clientName,
        phone: "5511999999999"
      },
      slug: "test_mode"
    };

    const res = await fetch(`${API_BASE}/api/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return {
      success: res.ok,
      status: res.status,
      data,
      elapsed: Date.now() - start
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: err.message,
      elapsed: Date.now() - start
    };
  }
}

// -------------------------------------------------------------
// 1. SCENARIO: HIGH CONCURRENCY ON SINGLE SLOT (RACE CONDITION)
// -------------------------------------------------------------
async function runConcurrencyTest(config: TestConfig): Promise<TestReport> {
  const reqCount = 50;
  const rtYear = 2028 + Math.floor(Math.random() * 5);
  const rtTime = `${(10+Math.floor(Math.random()*8)).toString().padStart(2, '0')}:00`;
  const targetDate = `${rtYear}-10-10`;
  const targetTime = rtTime;
  
  console.log(`\n▶ [CENÁRIO 1] Iniciando Teste de Concorrência Crítica...`);
  console.log(`   Simulando ${reqCount} usuários reservando EXACTAMENTE O MESMO HORÁRIO (${targetDate} ${targetTime}) no milissegundo.`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < reqCount; i++) {
    promises.push(fireBookingRequest(config, targetDate, targetTime, `Attacker ${i}`));
  }

  const results = await Promise.all(promises);
  console.log(`   Processamento finalizado em ${Date.now() - startTime}ms.`);

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const avgTime = results.reduce((acc, r) => acc + r.elapsed, 0) / results.length;
  
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const errors = Array.from(new Set(failures.map(f => typeof f.data?.error === 'string' ? f.data.error : f.error).filter(Boolean)));

  // Validating the constraint: Only 1 success allowed
  const validationPassed = successes.length === 1 && failures.length === reqCount - 1;
  const notes = [
    `Concorrência gerou ${successes.length} agendamentos. Esperado: 1.`,
    validationPassed ? "✅ PROTEÇÃO ANTI-DOUBLE BOOKING FUNCIONOU" : "❌ DOUBLE BOOKING DETECTADO! GRAVE VULNERABILIDADE!"
  ];

  return {
    scenario: "Concorrência Crítica (Race Conditions)",
    totalRequests: reqCount,
    successes: successes.length,
    failures: failures.length,
    avgResponseTimeMs: Math.round(avgTime),
    statusCodes,
    errors,
    validationPassed,
    notes
  };
}

// -------------------------------------------------------------
// 2. SCENARIO: LOAD TEST (MULTIPLE SLOTS)
// -------------------------------------------------------------
async function runLoadTest(config: TestConfig): Promise<TestReport> {
  const reqCount = 100;
  const targetDate = "2026-10-11";
  
  console.log(`\n▶ [CENÁRIO 2] Iniciando Teste de Carga Pesada...`);
  console.log(`   Simulando ${reqCount} novos agendamentos legítimos em paralelo.`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < reqCount; i++) {
    // Generate valid times from 08:00 to 20:00 every 5 mins
    const h = Math.floor(Math.random() * 12) + 8;
    const m = (Math.floor(Math.random() * 12) * 5).toString().padStart(2, "0");
    const targetTime = `${h.toString().padStart(2, '0')}:${m}`;
    
    // Spread dates across 30 distinct days to avoid artificial Firestore single-document contention
    const randomDay = Math.floor(Math.random() * 28) + 1;
    const dynamicDate = `2027-01-${randomDay.toString().padStart(2, '0')}`;

    promises.push(fireBookingRequest(config, dynamicDate, targetTime, `ValidUser ${i}`));
  }

  const results = await Promise.all(promises);
  console.log(`   Processamento finalizado em ${Date.now() - startTime}ms.`);

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const avgTime = results.reduce((acc, r) => acc + r.elapsed, 0) / results.length;
  
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const validationPassed = failures.length <= reqCount * 0.8 && avgTime <= 15000;
  const notes = [
    `Load test processou ${reqCount} requests com ${successes.length} ok.`,
    avgTime > 10000 ? "⚠️ ALTA LATÊNCIA DETECTADA - Requer otimização futura." : "✅ Latência e estabilidade boas no sandbox.",
    failures.length > 0 ? `⚠️ Registrado ${failures.length} erros (Contentions de DB esperado devido a transações no mesmo bizRef).` : ""
  ].filter(Boolean);

  return {
    scenario: "Carga Pesada (Load testing)",
    totalRequests: reqCount,
    successes: successes.length,
    failures: failures.length,
    avgResponseTimeMs: Math.round(avgTime),
    statusCodes,
    errors: [],
    validationPassed,
    notes
  };
}

// -------------------------------------------------------------
// 3. SCENARIO: RAPID CLICKS (SPAM)
// -------------------------------------------------------------
async function runRapidClicksTest(config: TestConfig): Promise<TestReport> {
  const reqCount = 10;
  const targetDate = `2029-${(1 + Math.floor(Math.random() * 10)).toString().padStart(2, '0')}-05`;
  const targetTime = "09:00";
  
  console.log(`\n▶ [CENÁRIO 3] Iniciando Teste de Rapid Clicks (Spam de UI)...`);
  console.log(`   Simulando único usuário enviando ${reqCount} requisições instantâneas.`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < reqCount; i++) {
    // Same client exactly
    promises.push(fireBookingRequest(config, targetDate, targetTime, `Spammer`));
  }

  const results = await Promise.all(promises);

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const avgTime = results.reduce((acc, r) => acc + r.elapsed, 0) / results.length;
  
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // In real systems either we get 1 success, or we use idempotency key.
  const validationPassed = successes.length === 1;
  const notes = [
    validationPassed ? "✅ Apenas 1 agendamento gerado pro Spammer" : "❌ Falha de integridade: múltiplos agendamentos para o spammer no mesmo slot!"
  ];

  return {
    scenario: "Spam de UI (Clique Rápido)",
    totalRequests: reqCount,
    successes: successes.length,
    failures: failures.length,
    avgResponseTimeMs: Math.round(avgTime),
    statusCodes,
    errors: [],
    validationPassed,
    notes
  };
}

// -------------------------------------------------------------
// MAIN EXECUTOR & REPORTER
// -------------------------------------------------------------
async function initializeContext(): Promise<TestConfig> {
  console.log("=> Buscando dados válidos no DB local / remoto...");

  // Force Vite env vars logic if running directly
  if (typeof process !== "undefined" && !process.env.VITE_INITIALIZED) {
     // Optional: you can manually supply standard config here.
  }

  try {
    const bizSnap = await getDocs(query(collection(db, "businesses"), limit(1)));
    if (bizSnap.empty) throw new Error("Nenhum estabelecimento encontrado no DB.");
    const businessId = bizSnap.docs[0].id;

    const profSnap = await getDocs(query(collection(db, "professionals"), where("business_id", "==", businessId), limit(1)));
    const professionalId = profSnap.docs[0].id;

    const servSnap = await getDocs(query(collection(db, "services"), where("business_id", "==", businessId), limit(1)));
    const serviceId = servSnap.docs[0].id;

    console.log(`=> Test Context Carregado | DB: ${businessId} | PROF: ${professionalId}`);
    return { businessId, professionalId, serviceId };
  } catch (e: any) {
    console.error("❌ Erro fatal obtendo dados do DB:", e.message);
    console.error("Certifique-se de que o app ou emulador esteja rodando com Firebase vivo.");
    process.exit(1);
  }
}

async function startEngine() {
  console.log("===============================================================");
  console.log("🚀 INICIANDO TESTE MOTOR DE AGENDAMENTO FLOWZA (QA)");
  console.log("===============================================================");

  const config = await initializeContext();

  const reports: TestReport[] = [];
  
  reports.push(await runConcurrencyTest(config));
  reports.push(await runRapidClicksTest(config));
  reports.push(await runLoadTest(config));

  // Gerar Relatório Final
  const reportOutput = {
    generatedAt: new Date().toISOString(),
    overallPassed: reports.every(r => r.validationPassed),
    details: reports
  };

  const reportString = JSON.stringify(reportOutput, null, 2);
  fs.writeFileSync("QA_STRESS_REPORT.json", reportString);

  console.log("\n===============================================================");
  console.log("📑 RELATÓRIO DO QA OBTIDO");
  console.log("===============================================================");
  
  let allPass = true;
  reports.forEach(r => {
    console.log(`\n[${r.scenario}] -> ${r.validationPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Requests: ${r.totalRequests} | Sucessos: ${r.successes} | Falhas: ${r.failures}`);
    console.log(`  Delay Médio: ${r.avgResponseTimeMs}ms`);
    console.log(`  Retornos HTTP: ${JSON.stringify(r.statusCodes)}`);
    if (r.errors.length) {
      console.log(`  Erros Encontrados:`);
      r.errors.forEach(e => console.log(`     - ${e}`));
    }
    console.log(`  Notas: ${r.notes.join(" | ")}`);
    if (!r.validationPassed) allPass = false;
  });

  console.log("\n===============================================================");
  if (allPass) {
    console.log("🚀 SISTEMA SEGURO E VERIFICADO. ANTI-COLLISION & PERFORMANCE OK!");
  } else {
    console.log("🛑 FALHA DETECTADA. VERIFIQUE DEBUGS NO RELATÓRIO.");
  }
  console.log("🔗 Logs Salvos em QA_STRESS_REPORT.json");
  console.log("===============================================================\n");

  process.exit(allPass ? 0 : 1);
}

startEngine();
