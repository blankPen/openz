/**
 * Playwright E2E 截图脚本 - Mobile Expo Web (增强版)
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';
const OUT_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function screenshot(page, name, fullPage = false) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`  📸 ${name}.png`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🚀 Mobile Expo Web E2E 截图测试\n');

  const browser = await chromium.launch({ headless: true });

  // ── 移动端视图 (390×844) ─────────────────────────────────────────────

  console.log('📱 移动端视图 (390×844)...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await mobileCtx.newPage();

  await page.goto(BASE);
  await page.waitForLoadState('domcontentloaded');
  await sleep(3000); // 给 RN Web 足够的渲染时间

  // 打印页面结构
  const body = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
  console.log('  Page HTML (first 2000 chars):', body.slice(0, 2000));

  await screenshot(page, 'mobile-home');

  // 尝试各种选择器
  const btnSel = '[role="button"], button, [aria-label], div[aria-label]';
  const btns = await page.locator(btnSel).all();
  console.log(`  Found ${btns.length} button-like elements`);
  for (let i = 0; i < Math.min(5, btns.length); i++) {
    const el = btns[i];
    const role = await el.getAttribute('role').catch(() => 'N/A');
    const label = await el.getAttribute('aria-label').catch(() => 'N/A');
    const text = (await el.textContent().catch(() => 'N/A')).slice(0, 50);
    console.log(`    [${i}] role=${role}, aria-label=${label}, text=${text}`);
  }

  await screenshot(page, 'mobile-conversation');
  await mobileCtx.close();

  await browser.close();
}

main().catch(console.error);
