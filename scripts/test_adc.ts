import admin from 'firebase-admin';
import * as fs from 'fs';

async function test() {
  const account = await admin.credential.applicationDefault().getAccessToken();
  console.log("Token:", account.access_token.substring(0, 20) + "...");
}
test();
