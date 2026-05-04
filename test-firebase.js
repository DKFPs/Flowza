import { initializeApp } from 'firebase/app';
import { getFirestore, doc, runTransaction, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const bizId = "demo-biz";
    const clientId = "demo-biz_999999999";
    const slotId = "demo-biz_p1_20261231_140000";

    await runTransaction(db, async (txn) => {
        const bizRef = doc(db, 'businesses', bizId);
        const cliRef = doc(db, 'clients', clientId);
        const aptRef = doc(db, 'appointments', slotId);

        // Dummy reads
        await txn.get(bizRef);
        await txn.get(cliRef);
        await txn.get(aptRef);

        txn.set(cliRef, {
            business_id: bizId,
            name: "Test Client",
            phone: "999999999",
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });

        // 5. Criar Agendamento
        txn.set(aptRef, {
            business_id: bizId,
            client_id: clientId,
            professional_id: "p1",
            service_id: "s1",
            appointment_date: "2026-12-31",
            start_time: "14:00:00",
            end_time: "14:30:00",
            status: "pending",
            recurrence_type: null,
            payment_status: "unpaid",
            payment_timing: "on_site",
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            client_name: "Test Client",
            client_phone: "999999999",
            service_name_snapshot: "Test Service"       
        });

        txn.update(bizRef, { usage_clients: increment(1) });
        txn.update(bizRef, { usage_appointments: increment(1) });
    });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
