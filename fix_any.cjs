const fs = require('fs');
const path = require('path');

const dir = './src/pages/global_admin';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.tsx')) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/<any\[\]>/g, '<Record<string, unknown>[]>');
    fs.writeFileSync(fullPath, content);
  }
});
console.log('Done!');
