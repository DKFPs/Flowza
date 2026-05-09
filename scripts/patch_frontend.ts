import fs from "fs";

let code = fs.readFileSync("src/pages/BookingPage.tsx", "utf-8");

if (!code.includes('idempotencyKey')) {
  code = code.replace(
    'professionalId: professional.id,',
    'professionalId: professional.id,\n            idempotencyKey: crypto.randomUUID(),\n            cfTurnstileToken: typeof window !== "undefined" ? (window as any).turnstileToken || "dev_mock_token" : "dev_mock_token",'
  );
}

fs.writeFileSync("src/pages/BookingPage.tsx", code);
console.log("Patched BookingPage.tsx");
