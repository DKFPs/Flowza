import { getDocs, collection } from "firebase/firestore";
import { db } from "../src/lib/firebase";

async function test() {
  const snaps = await getDocs(collection(db, "businesses"));
  snaps.forEach(snap => console.log("Biz ID:", snap.id));
  process.exit(0);
}
test();
