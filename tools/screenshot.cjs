#!/usr/bin/env node
const path = require('path');
const { chromium } = require('/root/开发/.tools/node_modules/playwright');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const file = 'file://' + path.join(ROOT, 'preview/index.html');
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 336, height: 480 }, deviceScaleFactor: 3 });
  await page.goto(file, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const content = document.querySelector('.content');
    const out = { pageH: 480, contentScrollH: content.scrollHeight, blocks: [] };
    [...content.children].forEach((el) => {
      const r = el.getBoundingClientRect();
      out.blocks.push({ cls: el.className, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) });
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  const out = path.join(ROOT, 'preview/shot-336x480@3x.png');
  await page.screenshot({ path: out });
  console.log('screenshot:', out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
