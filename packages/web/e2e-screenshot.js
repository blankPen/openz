/**
 * Playwright E2E 截图脚本
 *
 * 运行方式:
 *   node e2e-screenshot.js
 *
 * 截图输出: packages/web/screenshots/
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = 'http://localhost:5173';
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
  console.log('🚀 启动 Playwright E2E 截图测试\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // ── 首页 ────────────────────────────────────────────────────────────────

    console.log('📱 HomeScreen...');
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'home-default');

    // 填写 serverUrl（使用第一个 input）
    const inputs = page.locator('input');
    if (await inputs.count() > 0) {
      const serverInput = inputs.first();
      if (await serverInput.isVisible()) {
        await serverInput.fill('http://localhost:19999');
        await screenshot(page, 'home-server-filled');
        await sleep(200);
      }
    }

    // 点击第一个按钮（通常是连接按钮）
    const btns = page.locator('button');
    if (await btns.count() > 0) {
      await btns.first().click();
      await sleep(800);
      await screenshot(page, 'home-connecting');
    }

    // ── 会话页面 ────────────────────────────────────────────────────────────

    console.log('\n💬 ConversationScreen...');
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'conv-empty');

    // 找 textarea 输入框
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) {
      await textareas.first().fill('你好，这是一个测试消息');
      // 找发送按钮
      const allBtns = page.locator('button');
      const btnCount = await allBtns.count();
      if (btnCount > 0) {
        await allBtns.first().click();
        await sleep(2000);
        await screenshot(page, 'conv-after-send');
      }
    }

    await screenshot(page, 'conv-with-messages');

    // ── 模型选择 ────────────────────────────────────────────────────────────

    console.log('\n⚙️ ModelSwitchModal...');
    const modelBtns = page.locator('button');
    if (await modelBtns.count() > 1) {
      await modelBtns.nth(1).click();
      await sleep(400);
      await screenshot(page, 'model-switch');
      await modelBtns.first().click();
      await sleep(200);
    }

    // ── 附件弹窗 ──────────────────────────────────────────────────────────

    console.log('\n📎 AttachmentModal...');
    if (await modelBtns.count() > 2) {
      await modelBtns.nth(2).click();
      await sleep(400);
      await screenshot(page, 'attachment-modal');
      await modelBtns.first().click();
      await sleep(200);
    }

    // ── 设置页面 ────────────────────────────────────────────────────────────

    console.log('\n🔧 SettingsScreen...');
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'settings-default');

    const settingsInputs = page.locator('input');
    if (await settingsInputs.count() > 0) {
      await settingsInputs.first().fill('http://localhost:19999');
      await sleep(200);
      await screenshot(page, 'settings-server-url');
    }

    // ── 完整页面截图 ────────────────────────────────────────────────────────

    console.log('\n📐 完整页面截图...');
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'home-full', true);

    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'conv-full', true);

    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'settings-full', true);

    // ── 移动端视图 ──────────────────────────────────────────────────────────

    console.log('\n📱 移动端视图 (390x844)...');
    await context.close();
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${BASE}/`);
    await mobilePage.waitForLoadState('networkidle');
    await screenshot(mobilePage, 'mobile-home');

    await mobilePage.goto(`${BASE}/#/conversation`);
    await mobilePage.waitForLoadState('networkidle');
    await screenshot(mobilePage, 'mobile-conversation');

    await mobilePage.goto(`${BASE}/#/settings`);
    await mobilePage.waitForLoadState('networkidle');
    await screenshot(mobilePage, 'mobile-settings');

    await mobileContext.close();

    console.log('\n✅ 截图完成！输出目录:', OUT_DIR);
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
    console.log(`   共 ${files.length} 张截图:`);
    files.forEach((f) => console.log(`   - ${f}`));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
