import { adminDb } from "../src/lib/firebaseAdmin.ts";

async function check() {
  const q = await adminDb.collection("booking_attempts").limit(10).get();
  console.log("Real DB booking_attempts size:", q.size);
}
check();
