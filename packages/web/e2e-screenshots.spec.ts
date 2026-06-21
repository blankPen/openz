/**
 * Playwright E2E 截图测试 - 覆盖 Web 所有页面状态
 *
 * 运行方式:
 *   npx playwright test e2e-screenshots.spec.ts
 *
 * 截图输出: packages/web/screenshots/
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://localhost:5173';
const OUT_DIR = path.resolve(__dirname, 'screenshots');

// 确保输出目录存在
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// ── 辅助函数 ────────────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`  📸 截图: ${name}.png`);
}

async function screenshotFull(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.full.png`),
    fullPage: true,
  });
  console.log(`  📸 截图: ${name}.full.png`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

test.describe('OpenZ Web E2E 截图测试', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  // ── 首页 (HomeScreen) ──────────────────────────────────────────────────────

  test('HomeScreen - 默认状态（未连接服务器）', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'home-default');
  });

  test('HomeScreen - 输入 serverUrl 但未连接', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    // 找到 serverUrl 输入框
    const input = page.locator('input[placeholder*="server"], input[placeholder*="daemon"], input[placeholder*="localhost"]').first();
    if (await input.isVisible()) {
      await input.fill('http://localhost:19999');
    }
    await screenshot(page, 'home-server-filled');
  });

  test('HomeScreen - 连接中状态', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    // 点击连接按钮
    const btn = page.locator('button:has-text("连接"), button:has-text("Connect"), button:has-text("连接服务器")').first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'home-connecting');
    }
  });

  // ── 会话页面 (ConversationScreen) ────────────────────────────────────────

  test('ConversationScreen - 初始空会话状态', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'conv-empty');
  });

  test('ConversationScreen - 发送消息后（用户消息）', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 找到输入框
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.isVisible()) {
      await input.fill('你好，AI助手');
      // 找到发送按钮
      const sendBtn = page.locator('button:has-text("发送"), button:has-text("Send")').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'conv-user-message');
      }
    }
  });

  test('ConversationScreen - AI 思考中状态（thinking）', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 模拟发送消息并等待短暂响应（如果服务器没开则展示错误）
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.isVisible()) {
      await input.fill('你好');
      const sendBtn = page.locator('button:has-text("发送"), button:has-text("Send")').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'conv-thinking');
      }
    }
  });

  test('ConversationScreen - 多轮对话状态', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 发送两条消息
    for (let i = 0; i < 2; i++) {
      const input = page.locator('textarea, input[type="text"]').first();
      if (await input.isVisible()) {
        await input.fill(`消息 ${i + 1}`);
        const sendBtn = page.locator('button:has-text("发送"), button:has-text("Send")').first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
    await page.waitForTimeout(1000);
    await screenshot(page, 'conv-multi');
  });

  // ── 设置页面 (SettingsScreen) ─────────────────────────────────────────────

  test('SettingsScreen - 默认状态', async ({ page }) => {
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'settings-default');
  });

  test('SettingsScreen - 修改 serverUrl', async ({ page }) => {
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[type="text"], input[type="url"]').first();
    if (await input.isVisible()) {
      await input.fill('http://localhost:19999');
      await page.waitForTimeout(200);
      await screenshot(page, 'settings-server-url');
    }
  });

  // ── 模型选择弹窗 ──────────────────────────────────────────────────────────

  test('ModelSwitchModal - 打开模型选择', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 点击模型切换按钮
    const modelBtn = page.locator('button:has-text("Z1"), button:has-text("模型"), [data-testid="model-switch"]').first();
    if (await modelBtn.isVisible()) {
      await modelBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'model-switch');
    }
  });

  // ── 附件选择弹窗 ──────────────────────────────────────────────────────────

  test('AttachmentModal - 打开附件选择', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 点击附件按钮
    const attachBtn = page.locator('button[aria-label*="附件"], button[aria-label*="attachment"], [data-testid="attachment"]').first();
    if (await attachBtn.isVisible()) {
      await attachBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'attachment-modal');
    }
  });

  // ── 错误状态 ──────────────────────────────────────────────────────────────

  test('ErrorState - 连接失败', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');

    // 设置一个不存在的服务器
    const input = page.locator('input[placeholder*="server"], input[placeholder*="daemon"], input[placeholder*="localhost"]').first();
    if (await input.isVisible()) {
      await input.fill('http://invalid-server:19999');
    }
    // 尝试发送消息
    const msgInput = page.locator('textarea, input[type="text"]').first();
    if (await msgInput.isVisible()) {
      await msgInput.fill('test');
      const sendBtn = page.locator('button:has-text("发送"), button:has-text("Send")').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'error-connection');
      }
    }
  });

  // ── 完整页面滚动截图 ──────────────────────────────────────────────────────

  test('HomeScreen - 完整页面滚动', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await screenshotFull(page, 'home-full');
  });

  test('ConversationScreen - 完整页面滚动（多消息）', async ({ page }) => {
    await page.goto(`${BASE}/#/conversation`);
    await page.waitForLoadState('networkidle');
    await screenshotFull(page, 'conv-full');
  });
});
