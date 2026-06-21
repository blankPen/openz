/**
 * Playwright E2E SettingsScreen + Delete 功能测试
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';
const DAEMON = 'http://localhost:19999';
const OUT_DIR = path.resolve(__dirname, 'screenshots');

async function screenshot(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧪 SettingsScreen + 删除会话 E2E 测试\n');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForFunction(() => document.getElementById('root')?.children?.length > 0, { timeout: 15000 });
  await sleep(2000);

  let passed = 0, failed = 0;
  const assert = (name, cond) => {
    if (cond) { console.log(`  ✅ ${name}`); passed++; }
    else { console.log(`  ❌ ${name}`); failed++; }
  };

  // ── 打开 HistoryDrawer ─────────────────────────────────
  await page.locator('[aria-label="打开菜单"]').click();
  await sleep(1000);
  await screenshot(page, 'e2e-settings-1-drawer');

  // ── 打开 SettingsScreen ─────────────────────────────────
  // 点击"设置"按钮
  const settingsBtn = page.locator('text=设置').first();
  const hasSettingsBtn = await settingsBtn.count() > 0;
  assert('设置按钮存在', hasSettingsBtn);

  if (hasSettingsBtn) {
    await settingsBtn.click();
    await sleep(1000);
    await screenshot(page, 'e2e-settings-2-settings-screen');

    // 检查 SettingsScreen 元素
    const hasTitle = await page.locator('text=设置').count() > 0;
    const hasServerSection = await page.locator('text=服务器').count() > 0;
    const hasAppearanceSection = await page.locator('text=外观').count() > 0;
    const hasLanguageSection = await page.locator('text=语言').count() > 0;
    const hasInteractionSection = await page.locator('text=交互').count() > 0;
    const hasVoiceBroadcast = await page.locator('text=语音播报').count() > 0;
    const hasEnterSend = await page.locator('text=Enter 发送').count() > 0;
    const hasAutoPlay = await page.locator('text=AI 回复自动播报').count() > 0;

    assert('SettingsScreen 显示标题', hasTitle);
    assert('服务器区块存在', hasServerSection);
    assert('外观区块存在', hasAppearanceSection);
    assert('语言区块存在', hasLanguageSection);
    assert('交互区块存在', hasInteractionSection);
    assert('语音播报开关存在', hasVoiceBroadcast);
    assert('Enter 发送开关存在', hasEnterSend);
    assert('AI 回复自动播报开关存在', hasAutoPlay);

    // 关闭 SettingsScreen
    // 使用 testID 精确找到 SettingsScreen 的关闭按钮
    const closeBtnCount = await page.locator('[data-testid="settings-screen"] [aria-label="关闭"]').count();
    if (closeBtnCount > 0) {
      await page.locator('[data-testid="settings-screen"] [aria-label="关闭"]').click({ force: true });
    }
    await sleep(500);
  }

  // ── 删除会话测试 ─────────────────────────────────────────
  await page.keyboard.press('Escape'); // 关闭 drawer
  await sleep(500);

  // 重新打开抽屉
  await page.locator('[aria-label="打开菜单"]').click();
  await sleep(2000);
  await screenshot(page, 'e2e-settings-3-before-delete');

  // 获取删除前的会话数
  const sessionsBefore = await page.evaluate(async (daemonUrl) => {
    try {
      const res = await fetch(`${daemonUrl}/sessions`);
      const data = await res.json();
      return data.sessions?.length ?? 0;
    } catch { return 0; }
  }, DAEMON);
  console.log(`  当前会话数: ${sessionsBefore}`);
  assert('有会话可删除', sessionsBefore > 0);

  if (sessionsBefore > 0) {
    // 找到并长按第一个会话
    const timeLabel = page.locator('text=分钟前').first();
    if (await timeLabel.count() > 0) {
      await timeLabel.click({ delay: 700 });
      await sleep(800);
      await screenshot(page, 'e2e-settings-4-action-sheet');

      // 点击删除
      const deleteBtn = page.locator('text=删除').first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();
        await sleep(1000);
        await screenshot(page, 'e2e-settings-5-after-delete');

        // 验证会话数减少
        const sessionsAfter = await page.evaluate(async (daemonUrl) => {
          try {
            const res = await fetch(`${daemonUrl}/sessions`);
            const data = await res.json();
            return data.sessions?.length ?? 0;
          } catch { return -1; }
        }, DAEMON);
        console.log(`  删除后会话数: ${sessionsAfter}`);
        assert('会话已删除（数量减少）', sessionsAfter < sessionsBefore);
      }
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`结果: ${passed} 通过, ${failed} 失败`);
  console.log('═'.repeat(50));

  await ctx.close();
  await browser.close();
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
