import fs from "fs";

let code = fs.readFileSync("server.ts", "utf-8");

const mockCode = `
// --- IN-MEMORY MOCK FOR ADMINDB (ONLY FOR TESTING RATE LIMITS) ---
const mockStore: Record<string, any[]> = {
  booking_attempts: [],
  security_events: [],
  businesses: [{ id: "dP325sa0Rz1uuPeiCeXh", status: "active", enable_payment_setup: false, auto_confirm: true }],
  services: [{ id: "CaJqxhSLL9acARKjcm9Q", business_id: "dP325sa0Rz1uuPeiCeXh", duration: 30, price: 100 }],
  professionals: [{ id: "Ep5i9vfn9P3VBsXw0v9X", business_id: "dP325sa0Rz1uuPeiCeXh" }],
  daily_schedules: [],
  appointments: [],
  clients: [],
  processing_queue: [],
  system_events: []
};

const _originalAdminDb = adminDb;
const mockAdminDb = {
  getStore: () => mockStore,
  collection: (col: string) => {
    return {
      doc: (id?: string) => {
        const docId = id || Math.random().toString();
        return {
          id: docId,
          get: async () => {
            const data = mockStore[col]?.find(x => x.id === docId);
            return { exists: !!data, data: () => data };
          },
          set: async (data: any) => {
            if (!mockStore[col]) mockStore[col] = [];
            const idx = mockStore[col].findIndex(x => x.id === docId);
            const toSave = { ...data };
            if (data.createdAt) toSave.createdAt = new Date().toISOString();
            if (idx >= 0) mockStore[col][idx] = { ...mockStore[col][idx], ...toSave };
            else mockStore[col].push({ id: docId, ...toSave });
            if (col === "booking_attempts") console.log("[MOCK] added attempt. total:", mockStore[col].length);
          },
          update: async (data: any) => {
            if (!mockStore[col]) mockStore[col] = [];
            const idx = mockStore[col].findIndex(x => x.id === docId);
            if (idx >= 0) mockStore[col][idx] = { ...mockStore[col][idx], ...data };
          }
        };
      },
      add: async (data: any) => {
        if (!mockStore[col]) mockStore[col] = [];
        mockStore[col].push({ id: Math.random().toString(), ...data });
      },
      where: function(field: string, op: string, val: any) {
        let results = mockStore[col] || [];
        results = results.filter((x: any) => {
           if (!x) return false;
           if (op === "==") return x[field] === val;
           if (op === ">") return new Date(x[field] || new Date()) > new Date(val);
           return false;
        });

        const filterObj = (curResults: any[]) => ({
           where: (nField: string, nOp: string, nVal: any) => {
              let fResults = curResults.filter((x: any) => {
                 if (!x) return false;
                 if (nOp === "==") return x[nField] === nVal;
                 if (nOp === ">") return new Date(x[nField] || new Date()) > new Date(nVal);
                 return false;
              });
              return filterObj(fResults);
           },
           limit: () => ({
             get: async () => ({ empty: curResults.length === 0, size: curResults.length, docs: curResults.map(r => ({ data: () => r })) })
           }),
           get: async () => {
             if (col === "booking_attempts") console.log("[MOCK] query size:", curResults.length);
             return { empty: curResults.length === 0, size: curResults.length, docs: curResults.map(r => ({ data: () => r })) };
           }
        });
        
        return filterObj(results);
      }
    };
  },
  runTransaction: async (cb: any) => {
     // simple mock transaction
     const transaction = {
       get: async (ref: any) => ref.get(),
       set: (ref: any, data: any) => ref.set(data),
       update: (ref: any, data: any) => ref.update(data)
     };
     return await cb(transaction);
  }
};
// @ts-ignore
adminDb = mockAdminDb;

// Inject /api/mock to see store
setTimeout(() => {
  const expressA = require("express");
  const dRouter = expressA.Router();
  dRouter.get("/", (req:any, res:any) => res.json(mockStore));
  // how to inject? Just wait for app to be ready? No, we can't easily.
  // Better inject into server.ts below!
}, 1000);
// ----------------------------------------------------------------
`;

// remove old mock
code = code.replace(/\/\/ --- IN-MEMORY MOCK FOR ADMINDB.*?\/\/ ----------------------------------------------------------------\n/s, '');

if (!code.includes("mockAdminDb")) {
  code = code.replace(
    'import { adminDb as realAdminDb } from "./src/lib/firebaseAdmin.js";',
    'import { adminDb as realAdminDb } from "./src/lib/firebaseAdmin.js";\nlet adminDb: any = realAdminDb;\n' + mockCode
  );
  
  // Inject mock route
  code = code.replace(
    'app.get("/api/health", (req, res) => {',
    'app.get("/api/mockstore", (req, res) => { res.json(adminDb.getStore()); });\n  app.get("/api/health", (req, res) => {'
  );
  
  fs.writeFileSync("server.ts", code);
}
