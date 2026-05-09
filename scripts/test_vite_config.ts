import { createServer } from 'vite';
async function run() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  console.log(vite.config.server.hmr);
  process.exit(0);
}
run();
