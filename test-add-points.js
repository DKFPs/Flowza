import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs, limit, serverTimestamp } from "firebase/firestore";
import fs from "fs";

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app);

async function run() {
  try {
     console.log("running test...");
     const points = 10;
     const businessId = "h_m6T-1g";
     const clientId = "h_m6T-1g_5541999999999";
     await addDoc(collection(db, "loyalty_points"), {
      business_id: businessId,
      client_id: clientId,
      points: points,
      source: 'bonus',
      reference_id: "manual",
      created_at: serverTimestamp()
    });
    console.log("loyalty points added");

    const balanceQuery = query(
      collection(db, "loyalty_balances"), 
      where("business_id", "==", businessId),
      where("client_id", "==", clientId),
      limit(1)
    );
    const balanceSnap = await getDocs(balanceQuery);
    console.log("queried loyalty balances");
  } catch(e) {
     console.error(e);
  }
}
run();
