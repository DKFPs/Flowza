import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'gen-lang-client-0509735842'
});
const db = getFirestore();
async function test() {
  try {
     const res = await db.collection("businesses").limit(1).get();
     console.log("Success:", res.size);
  } catch(e:any) {
     console.log("Error:", e.message);
  }
}
test();
