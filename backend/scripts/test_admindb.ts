import { adminDb } from "../src/lib/firebaseAdmin.ts";

async function test() {
  try {
    const s = await adminDb.collection("businesses").limit(1).get();
    console.log("Success with adminDb! Found docs: " + s.size);
  } catch(e:any) {
    console.log("Error:", e.message);
  }
}
test();
