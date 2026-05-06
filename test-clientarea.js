import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const bizId = "demo-biz";
    // 1. client
    const clientQuery = query(collection(db, "clients"), where("business_id", "==", bizId), limit(1));
    const clientSnap = await getDocs(clientQuery);
    console.log("Clients OK");

    const clientId = clientSnap.docs[0]?.id || "demo";
    // 2. appointments
    const aptsQuery = query(collection(db, "appointments"), where("client_id", "==", clientId), limit(20));
    await getDocs(aptsQuery);
    console.log("Appointments OK");
    
    // 3. loyalty_balances
    const loyaltyQuery = query(collection(db, "loyalty_balances"), where("client_id", "==", clientId), limit(1));
    await getDocs(loyaltyQuery);
    console.log("Loyalty balances OK");

    // 4. redemptions
    const redQuery = query(collection(db, "loyalty_redemptions"), where("client_id", "==", clientId));
    await getDocs(redQuery);
    console.log("Loyalty redemptions OK");

    // 5. reviews
    const reviewsQuery = query(collection(db, "reviews"), where("client_id", "==", clientId));
    await getDocs(reviewsQuery);
    console.log("Reviews OK");

  } catch(e) {
    console.log("ERR:", e.message);
  }
}
test();
