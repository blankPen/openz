/**
 * Playwright 调试 - 检查 HistoryDrawer DOM 结构
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // 打开抽屉
  const btns = page.locator('[role="button"]');
  if (await btns.count() > 0) {
    await btns.first().click();
    await new Promise(r => setTimeout(r, 1000));
  }

  // 打印 DOM 中所有元素
  const elements = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const result = [];
    for (const el of all) {
      if (el.children.length === 0 || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') {
        result.push({
          tag: el.tagName,
          id: el.id,
          testid: el.getAttribute('data-testid'),
          placeholder: el.getAttribute('placeholder'),
          type: el.getAttribute('type'),
          ariaLabel: el.getAttribute('aria-label'),
          value: el.value,
          text: el.textContent?.slice(0, 50),
        });
      }
    }
    return result;
  });

  console.log('DOM elements with inputs/buttons:');
  elements.forEach(el => console.log(JSON.stringify(el)));

  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'debug-drawer-dom.png') });
  console.log('Screenshot saved');
  await browser.close();
}

main().catch(console.error);
