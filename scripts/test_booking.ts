import { runTransaction, doc, increment, serverTimestamp, getDocs, collection } from "firebase/firestore";
import { db } from "../src/lib/firebase";

async function test() {
  try {
    const businessId = "dP325sa0Rz1uuPeiCeXh";
    let professionalId = "prof_1";
    let serviceId = "srv_1";
    
    const profSnaps = await getDocs(collection(db, "professionals"));
    if(!profSnaps.empty) professionalId = profSnaps.docs[0].id;
    
    const servSnaps = await getDocs(collection(db, "services"));
    if(!servSnaps.empty) serviceId = servSnaps.docs[0].id;

    const clientId = `${businessId}_5511999999999`;
    const aptDateStr = "2026-10-10";
    const startTimeStr = "09:00:00";
    const slotId = `${businessId}_${professionalId}_20261010_090000`;

    await runTransaction(db, async (transaction) => {
      const bizRef = doc(db, "businesses", businessId);
      const clientRef = doc(db, "clients", clientId);
      const aptRef = doc(db, "appointments", slotId);

      const bizDoc = await transaction.get(bizRef);
      const clientSnap = await transaction.get(clientRef);
      const aptSnap = await transaction.get(aptRef);

      transaction.set(aptRef, {
               business_id: businessId,
               client_id: clientId,
               professional_id: professionalId,
               service_id: serviceId,
               additional_service_ids: [],
               total_price: 150,
               appointment_date: aptDateStr,
               start_time: startTimeStr,
               end_time: "09:30:00",
               status: "confirmed",
               recurrence_type: null,
               payment_status: "unpaid",
               payment_timing: "on_site",
               created_at: serverTimestamp(),
               updated_at: serverTimestamp(),
               client_name: "Test Name",
               client_phone: "11999999999",
               service_name_snapshot: "Test Service"
      });

      if (!clientSnap.exists()) {
        transaction.set(clientRef, {
          business_id: businessId,
          name: "Test Name",
          phone: "11999999999",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          appointments_count: 1,
          total_revenue: 150,
          last_appointment_date: serverTimestamp()
        });
      } else {
        transaction.update(clientRef, {
          name: "Test Name",
          updated_at: serverTimestamp(),
          appointments_count: increment(1),
          total_revenue: increment(150),
          last_appointment_date: serverTimestamp()
        });
      }

      transaction.update(bizRef, { usage_appointments: increment(1) });
    });
    console.log("Success");
    process.exit(0);
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
test();
