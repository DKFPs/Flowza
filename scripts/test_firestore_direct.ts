import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

// Load firebase config
const configStr = fs.readFileSync("./firebase-applet-config.json", "utf-8");
const config = JSON.parse(configStr);

// Use standard Client SDK (NOT Admin SDK)
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function testDirectWrite() {
  try {
    console.log("Tentando criar appointment diretamente via Firestore Client SDK...");
    const dummyId = "fake_biz_professional_20261010_1100";
    const ref = doc(db, "appointments", dummyId);
    
    // Tentando burlar enviando o sys_token que funcionava antes
    await setDoc(ref, {
      business_id: "fake_biz",
      client_name: "Hacker Test",
      _sys_token: "FLOWZA_SECURE_API"
    });
    
    console.log("FALHA DE SEGURANÇA: A gravação foi permitida!");
    process.exit(1);
  } catch (error: any) {
    console.log("SUCESSO: Acesso negado pelo Firestore.");
    console.log("Erro capturado:", error.message);
    process.exit(0);
  }
}

testDirectWrite();
