import axios from "axios";

const apiUrl = "http://localhost:3000/api/book";

const basePayload = {
  businessId: "dP325sa0Rz1uuPeiCeXh",
  serviceId: "CaJqxhSLL9acARKjcm9Q", 
  professionalId: "Ep5i9vfn9P3VBsXw0v9X",
  selectedDate: "2026-10-10",
  selectedTime: "12:00",
  customerName: "Audit Test Client",
  customerPhone: "11999999999",
  cfTurnstileToken: "dummy_token"
};

async function runTest() {
  for (let i = 0; i < 7; i++) {
    const res = await axios.post(apiUrl, { ...basePayload, selectedTime: `12:0${i}`, idempotencyKey: `teste_ip_unique_${Date.now()}_${i}` }, { headers: { 'x-bypass-bot': 'true_for_test' }, validateStatus: () => true });
    console.log(`req ${i}: status ${res.status}`, res.data);
  }
  
  const storeRes = await axios.get("http://localhost:3000/api/mockstore");
  console.log("Mock Store booking attempts:");
  console.log(storeRes.data.booking_attempts);
}
runTest();
