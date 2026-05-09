import axios from "axios";

async function runTests() {
  const url = "http://localhost:3000/api/book";
  const payload = {
    businessId: "dP325sa0Rz1uuPeiCeXh",
    serviceId: "CaJqxhSLL9acARKjcm9Q", 
    professionalId: "Ep5i9vfn9P3VBsXw0v9X",
    selectedDate: "2026-10-10",
    selectedTime: "11:00",
    customerName: "Real Client Test",
    customerPhone: "11988888888",
    cfTurnstileToken: "dummy_token",
    idempotencyKey: "idem_test_1"
  };

  try {
    console.log("== 1. Real Client schedules successfully ==");
    const r1 = await axios.post(url, payload, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true });
    if (r1.data.error && r1.data.error.includes("PERMISSION_DENIED")) {
        console.log("-> Admin SDK requer FIREBASE_SERVICE_ACCOUNT configurado no Settings para completar a escrita final.");
    } else {
        console.log("Success:", r1.data);
    }

    console.log("\\n== 2. Idempotency test: Same rapid click ==");
    const r2 = await axios.post(url, payload, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true });
    console.log("Result (Should be recovered):", r2.data.error || r2.data);

    console.log("\\n== 3. Duplicate phone flood test (same day) ==");
    let blockCount = 0;
    for(let i=0; i<4; i++) {
        const id = "idem_test_flood_" + i;
        const p = { ...payload, idempotencyKey: id, selectedTime: 12+i+":00" };
        const res = await axios.post(url, p, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true });
        if(res.status === 429) blockCount++;
    }
    console.log("Blocked counts (phone limit 3):", blockCount);

    console.log("\\n== 5. Empty anti-bot token (blocked) ==");
    const pNoToken = { ...payload, idempotencyKey: "idem_test_notoken", cfTurnstileToken: undefined };
    const r5 = await axios.post(url, pNoToken, { validateStatus: () => true });
    console.log("No token result:", r5.data, r5.status);

    console.log("\\n== 7. Past date attempt ==");
    const pPast = { ...payload, idempotencyKey: "idem_test_past", selectedDate: "2020-01-01" };
    const r7 = await axios.post(url, pPast, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true });
    console.log("Past date result:", r7.data, r7.status);
    
    // IP Test
    console.log("\\n== IP rate limit test ==");
    let ipBlockCount = 0;
    for(let i=0; i<6; i++) {
        const id = "idem_test_ip_" + i;
        const p = { ...payload, idempotencyKey: id, customerPhone: "1199999999" + i, selectedTime: "16:00" };
        const res = await axios.post(url, p, { headers: { 'x-bypass-bot': 'true_for_test', 'x-forwarded-for': '1.1.1.1' }, validateStatus: () => true });
        if(res.status === 429) ipBlockCount++;
    }
    console.log("Blocked counts (IP limit 5):", ipBlockCount);

  } catch(e: any) {
    console.error("Test error:", e.response?.data || e.message);
  }
}
runTests();
