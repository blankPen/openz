/**
 * Playwright E2E 截图脚本
 *
 * 运行方式:
 *   npx tsx e2e-screenshot.ts
 *
 * 截图输出: packages/web/screenshots/
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://localhost:5173';
const OUT_DIR = path.resolve(__dirname, 'screenshots');

// 确保输出目录存在
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// ── 辅助函数 ────────────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string, fullPage = false) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`  📸 ${name}.png`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 主测试 ─────────────────────────────────────────────────────────────────

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

    // 填写 serverUrl
    const serverInput = page.locator('input[placeholder*="server" i], input[placeholder*="daemon" i], input[placeholder*="localhost" i]').first();
    if (await serverInput.isVisible()) {
      await serverInput.fill('http://localhost:19999');
      await screenshot(page, 'home-server-filled');
      await serverInput.press('Tab');
      await sleep(200);
    }

    // 点击连接按钮
    const connectBtn = page.locator('button:has-text("连接" i), button:has-text("connect" i), button:has-text("连接服务器" i)').first();
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await sleep(800);
      await screenshot(page, 'home-connecting');
    }

    // ── 会话页面 ────────────────────────────────────────────────────────────

    console.log('\n💬 ConversationScreen...');
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'conv-empty');

    // 发送消息
    const msgInput = page.locator('textarea, input[type="text"]').first();
    if (await msgInput.isVisible()) {
      await msgInput.fill('你好，这是一个测试消息');
      const sendBtn = page.locator('button:has-text("发送" i), button:has-text("send" i), [aria-label*="send" i]').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await sleep(1500);
        await screenshot(page, 'conv-after-send');
      }
    }

    // 思考气泡
    const thinkingEl = page.locator('[class*="thinking"], [class*="思考"], [data-testid*="thinking"]').first();
    if (await thinkingEl.isVisible()) {
      await screenshot(page, 'conv-thinking');
    }

    // 关闭连接提示后截图
    await screenshot(page, 'conv-with-messages');

    // ── 模型选择 ────────────────────────────────────────────────────────────

    console.log('\n⚙️ ModelSwitchModal...');
    const modelBtn = page.locator('button[aria-label*="model" i], button[aria-label*="模型" i], [data-testid*="model" i]').first();
    if (await modelBtn.isVisible()) {
      await modelBtn.click();
      await sleep(400);
      await screenshot(page, 'model-switch');

      // 关闭
      const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="关闭" i], [aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await sleep(200);
      }
    }

    // ── 附件弹窗 ────────────────────────────────────────────────────────────

    console.log('\n📎 AttachmentModal...');
    const attachBtn = page.locator('button[aria-label*="attachment" i], button[aria-label*="附件" i], [data-testid*="attachment" i]').first();
    if (await attachBtn.isVisible()) {
      await attachBtn.click();
      await sleep(400);
      await screenshot(page, 'attachment-modal');

      const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="关闭" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await sleep(200);
      }
    }

    // ── 设置页面 ────────────────────────────────────────────────────────────

    console.log('\n🔧 SettingsScreen...');
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'settings-default');

    // 修改 serverUrl
    const settingsInput = page.locator('input[type="text"], input[type="url"]').first();
    if (await settingsInput.isVisible()) {
      await settingsInput.fill('http://localhost:19999');
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
