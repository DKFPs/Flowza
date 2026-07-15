const fs = require('fs');
const path = require('path');

function walkAndReplace(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkAndReplace(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // We want to replace fetch("/api/..."), fetch('/api/...'), fetch(`/api/...`)
      // with fetch((import.meta.env.VITE_API_URL || "") + "/api/...")
      
      let modified = false;
      if (content.includes('fetch("/api/')) {
        content = content.replace(/fetch\("\/api\//g, 'fetch((import.meta.env.VITE_API_URL || "") + "/api/');
        modified = true;
      }
      if (content.includes("fetch('/api/")) {
        content = content.replace(/fetch\('\/api\//g, 'fetch((import.meta.env.VITE_API_URL || "") + "/api/');
        modified = true;
      }
      if (content.includes('fetch(`/api/')) {
        content = content.replace(/fetch\(`\/api\//g, 'fetch(`${import.meta.env.VITE_API_URL || ""}/api/');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

walkAndReplace('frontend/src');
console.log("Fetch patched.");
