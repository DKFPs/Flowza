import { createServer } from 'vite';
import fs from 'fs';
async function run() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  const html = fs.readFileSync('index.html', 'utf-8');
  const res = await vite.transformIndexHtml('/', html);
  console.log(res);
  process.exit(0);
}
run();
