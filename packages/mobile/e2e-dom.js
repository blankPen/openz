/**
 * Playwright E2E - 调试 DOM 结构
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // 打印完整 DOM 结构（前 5000 字符）
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log('DOM:', html.slice(0, 5000));

  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'debug-dom.png') });
  await browser.close();
}

main().catch(console.error);
