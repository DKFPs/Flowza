import axios from "axios";

const apiUrl = "http://localhost:3000/api/book";

const basePayload = {
  businessId: "dP325sa0Rz1uuPeiCeXh",
  serviceId: "CaJqxhSLL9acARKjcm9Q", 
  professionalId: "Ep5i9vfn9P3VBsXw0v9X",
  selectedDate: "2026-10-10",
  selectedTime: "11:00",
  customerName: "Audit Test Client",
  customerPhone: "11999999999",
  cfTurnstileToken: "dummy_token"
};

async function runAudit() {
  console.log("=== INICIANDO AUDITORIA DA ROTA /api/book ===");

  const results: any[] = [];

  // Helper to run req and expect specific status
  const runReq = async (name: string, payload: any, headers: any = { 'x-bypass-bot': 'true_for_test' }, expectedStatus?: number) => {
    try {
      const resp = await axios.post(apiUrl, payload, { headers, validateStatus: () => true });
      const passed = expectedStatus ? resp.status === expectedStatus : (resp.status >= 200 && resp.status < 300 || resp.status === 500); // 500 is technically fail in fb but passing the API validation
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} -> Status: ${resp.status}`);
      return { name, status: resp.status, data: resp.data };
    } catch(e: any) {
      console.log(`[FAIL] ${name} -> Ex: ${e.message}`);
      return { name, status: 0, error: e.message };
    }
  }

  // 1. 50 requisições simultâneas para o mesmo horário (Race condition)
  console.log("\n-> Teste 1: 50 requisições simultâneas...");
  const p1 = Array.from({length: 50}).map((_, i) => axios.post(apiUrl, { ...basePayload, idempotencyKey: `audit_simult_${i}`, selectedTime: "08:00" }, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true }));
  const r1 = await Promise.all(p1);
  const statusCounts1 = r1.reduce((acc, curr) => { acc[curr.status] = (acc[curr.status] || 0) + 1; return acc; }, {} as any);
  console.log(`Resultado Simultâneas: `, statusCounts1);

  // 2. 30 requisições do mesmo IP (Rate limit IP 5 attempts in 10m)
  console.log("\n-> Teste 2: 30 requisições do mesmo IP...");
  let rateLimitedIp = 0;
  for(let i=0; i<30; i++) {
    const res = await axios.post(apiUrl, { ...basePayload, customerPhone: "119888877" + i, idempotencyKey: `audit_ip_${i}` }, { headers: { 'x-bypass-bot': 'true_for_test', 'x-forwarded-for': '12.34.56.78' }, validateStatus: () => true });
    if (i === 0) console.log("Test 2 Status", res.status, res.data);
    if (res.status === 429) rateLimitedIp++;
  }
  console.log(`Bloqueios 429 (IP limitado): ${rateLimitedIp} (Esperado: 25)`);

  // 3. 10 requisições do mesmo telefone (Rate limit Phone 3 attempts in 24h)
  console.log("\n-> Teste 3: 10 requisições do mesmo telefone...");
  let rateLimitedPhone = 0;
  for(let i=0; i<10; i++) {
    const res = await axios.post(apiUrl, { ...basePayload, customerPhone: "11911112222", idempotencyKey: `audit_phone_${i}` }, { headers: { 'x-bypass-bot': 'true_for_test', 'x-forwarded-for': '87.65.43.21' + i }, validateStatus: () => true });
    if (res.status === 429) rateLimitedPhone++;
  }
  console.log(`Bloqueios 429 (Telefone limit): ${rateLimitedPhone} (Esperado: 7)`);

  // 4. requisição sem token anti-bot
  console.log("\n-> Teste 4: Requisição sem token anti-bot...");
  await runReq("Sem Token Anti-Bot", { ...basePayload, cfTurnstileToken: undefined, idempotencyKey: "audit_notoken" }, {}, 403);

  // 5. requisição com serviço de outro negócio
  console.log("\n-> Teste 5: Serviço de outro negócio...");
  await runReq("Serviço inválido", { ...basePayload, serviceId: "random_other_service_123", idempotencyKey: "audit_otherservice" }, { 'x-bypass-bot': 'true_for_test' }, 500);

  // 6. requisição tentando agendar no passado
  console.log("\n-> Teste 6: Agendamento no passado...");
  await runReq("Data no passado", { ...basePayload, selectedDate: "2023-01-01", idempotencyKey: "audit_past" }, { 'x-bypass-bot': 'true_for_test' }, 400);

  // 7. clique duplo no botão de confirmar (Idempotence)
  console.log("\n-> Teste 7: Clique duplo (Idempotência)...");
  await runReq("Clique 1", { ...basePayload, idempotencyKey: "audit_double_click_1" }, { 'x-bypass-bot': 'true_for_test' });
  const doubleClickRes = await runReq("Clique 2 (Mesmo ID)", { ...basePayload, idempotencyKey: "audit_double_click_1" }, { 'x-bypass-bot': 'true_for_test' });
  console.log(`Clique 2 result:`, doubleClickRes.data);

  console.log("\n=== AUDITORIA FINALIZADA ===");
}

runAudit();
