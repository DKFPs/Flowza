import { adminDb } from "../server";

async function readQueue() {
  try {
    const snaps = await adminDb.collection("processing_queue").where("type", "==", "fallback_appointment_creation").get();
    snaps.forEach(s => {
      console.log(s.id, s.data().payload.error);
    });
    process.exit(0);
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}
readQueue();
