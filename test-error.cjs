import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
      if(msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });
  
  page.on('pageerror', err => {
      console.log('PAGE EXCEPTION:', err.message);
  });

  await page.goto('http://localhost:3000/demo');
  // wait for render
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
})();
