
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

async function setupMock(collection: string, id: string, data: any) {
  await axios.post(`${API_BASE}/api/audit/mock-setup`, { collection, id, data });
}

async function triggerWebhook(type: string, data: any) {
  // We send as JSON because our server falls back to JSON.parse(req.body) if no signature/secret is present
  await axios.post(`${API_BASE}/api/webhooks/stripe`, {
    type,
    data: { object: data }
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function testSuggestStyle(businessId: string) {
  try {
    const res = await axios.post(`${API_BASE}/api/suggest-style`, {
      businessId,
      imageUrl: "data:image/jpeg;base64,mOckimAgeData",
      galleryStyles: ["Social"]
    }, { validateStatus: () => true });
    if (res.status === 500) {
      console.log(`[DEBUG] 500 Response Body:`, JSON.stringify(res.data));
    }
    return res.status;
  } catch (e: any) {
    console.log(`[DEBUG] Request Error:`, e.message);
    return e.response?.status || 500;
  }
}

async function runAudit() {
  console.log("=== INICIANDO AUDITORIA DE BILLING FLOWZA ===");

  // 1. FREE USER -> PREIMUM AI
  console.log("\n-> Teste 1: Usuário FREE tentando acessar IA Premium");
  await setupMock('businesses', 'biz_free', { plan_id: 'FREE', owner_id: 'user_1' });
  const status1 = await testSuggestStyle('biz_free');
  console.log(`Status: ${status1} (Esperado: 403)`);

  // 2. PRO USER -> PREMIUM AI
  console.log("\n-> Teste 2: Usuário PRO tentando acessar IA Premium");
  await setupMock('businesses', 'biz_pro', { plan_id: 'PRO', owner_id: 'user_1' });
  const status2 = await testSuggestStyle('biz_pro');
  console.log(`Status: ${status2} (Esperado: 403)`);

  // 3. CANCELLED USER
  console.log("\n-> Teste 3: Usuário Cancelado via Webhook");
  await setupMock('businesses', 'biz_cancel', { plan_id: 'PREMIUM', stripe_customer_id: 'cus_cancel', owner_id: 'user_1' });
  await triggerWebhook('customer.subscription.deleted', { customer: 'cus_cancel', id: 'sub_cancel' });
  const status3 = await testSuggestStyle('biz_cancel');
  console.log(`Status pós-cancelamento: ${status3} (Esperado: 403)`);

  // 4. PAYMENT FAILED (PAST_DUE)
  console.log("\n-> Teste 4: Pagamento Recusado (past_due)");
  await setupMock('businesses', 'biz_failed', { plan_id: 'PREMIUM', stripe_customer_id: 'cus_failed', owner_id: 'user_1' });
  await triggerWebhook('customer.subscription.updated', { customer: 'cus_failed', id: 'sub_failed', status: 'past_due' });
  const status4 = await testSuggestStyle('biz_failed');
  console.log(`Status com past_due: ${status4} (Esperado: 403 - ATENÇÃO: Se for 200/500, a segurança falhou)`);

  // 5. WEBHOOK CHECKOUT COMPLETED (Activation)
  console.log("\n-> Teste 5: Webhook checkout.session.completed");
  await setupMock('businesses', 'biz_new', { plan_id: 'FREE', owner_id: 'user_new' });
  await triggerWebhook('checkout.session.completed', {
    client_reference_id: 'biz_new',
    customer: 'cus_new',
    subscription: 'sub_new',
    metadata: { planId: 'PREMIUM', businessId: 'biz_new' }
  });
  const status5 = await testSuggestStyle('biz_new');
  console.log(`Status após ativação: ${status5} (Esperado: 200 - Gemini pode reclamar de API Key mas validamos o status 200 se passar do check de plano)`);

  // 6. PLAN SPOOFING ATTEMPT
  console.log("\n-> Teste 6: Tentativa de Spoofing no Checkout");
  const spoofRes = await axios.post(`${API_BASE}/api/checkout`, {
    priceId: 'price_id_cheap',
    businessId: 'biz_spoof',
    planId: 'PREMIUM', // Trying to get premium metadata with cheap price
    customerEmail: 'test@example.com',
    successUrl: 'http://ok',
    cancelUrl: 'http://no'
  }, { validateStatus: () => true });
  console.log(`Checkout result metadata sent: ${spoofRes.status === 200 ? 'SUCCESS (VULNERABILITY CONFIRMED: price vs planId not validated)' : 'REJECTED'}`);

  console.log("\n=== AUDITORIA FINALIZADA ===");
}

runAudit();
