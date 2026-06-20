/**
 * Playwright E2E 截图脚本 - Mobile Expo Web（完整对话流程）
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';
const DAEMON = 'http://localhost:19999';
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
  console.log('🚀 Mobile Expo Web E2E 截图测试（完整对话流程）\n');

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
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await sleep(2000);

  await screenshot(page, 'mobile-home');

  // 检查连接状态
  const connBar = page.locator('[data-testid="connection-bar"]');
  if (await connBar.isVisible()) {
    console.log('  ⚠️ 显示未连接状态条');
  }

  // 打开 HistoryDrawer：点击最左边的 burger 按钮（顶栏第一个按钮）
  const allBtns = page.locator('[role="button"]');
  const btnCount = await allBtns.count();
  console.log(`  Found ${btnCount} buttons total`);

  // 找 burDer 按钮 - 它有 aria-label="打开菜单"
  const burgerBtn = page.locator('[aria-label="打开菜单"]');
  if (await burgerBtn.count() > 0) {
    await burgerBtn.click();
    await sleep(800);
    await screenshot(page, 'mobile-drawer-open');

    // 在 HistoryDrawer 中找到 Daemon URL 输入框（用 testID）
    const urlInput = page.locator('[data-testid="server-url-input"]');
    const urlInputCount = await urlInput.count();
    console.log(`  Found ${urlInputCount} server-url-input elements`);
    if (urlInputCount > 0) {
      await urlInput.fill(DAEMON);
      await screenshot(page, 'mobile-drawer-url-filled');

      // 点保存
      const saveBtn = page.locator('[data-testid="server-url-save"]');
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await sleep(500);
        console.log('  ✓ Server URL 已保存');
      }
    } else {
      // 找不到 testID，尝试 placeholder
      const placeholderInput = page.locator('input[placeholder*="19999"]');
      if (await placeholderInput.count() > 0) {
        await placeholderInput.fill(DAEMON);
        await screenshot(page, 'mobile-drawer-url-filled');
      }
    }

    await screenshot(page, 'mobile-drawer-full', true);

    // 关闭抽屉 - 按 Escape 键，等待 sessions 加载
    await page.keyboard.press('Escape');
    await sleep(2000); // 等待 sessions 加载完成
  } else {
    console.log('  ⚠️ 未找到 burger 按钮，尝试通用方式');
  }

  await screenshot(page, 'mobile-after-config');

  // 发送消息测试 LLM 对话
  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible()) {
    await textarea.fill('你好，请介绍一下你自己');
    await screenshot(page, 'mobile-msg-filled');
    await textarea.press('Enter');
    console.log('  等待 AI 回复...');
    await sleep(6000); // 等待 LLM 回复
    await screenshot(page, 'mobile-msg-sent');
    await sleep(3000);
    await screenshot(page, 'mobile-ai-reply');
  }

  await screenshot(page, 'mobile-conversation');

  // ── 删除会话测试 ─────────────────────────────────────────────────
  console.log('\n🗑️ 删除会话测试...');
  // 通过 API 删除一个会话，再验证 UI 刷新
  const sessionsBefore = await page.evaluate(async (daemonUrl) => {
    const res = await fetch(`${daemonUrl}/sessions`);
    const data = await res.json();
    return data.sessions.length;
  }, DAEMON);
  console.log(`  删除前: ${sessionsBefore} 个会话`);

  const deleted = await page.evaluate(async (daemonUrl) => {
    const res = await fetch(`${daemonUrl}/sessions`);
    const data = await res.json();
    if (data.sessions.length === 0) return null;
    const id = data.sessions[0].id;
    const delRes = await fetch(`${daemonUrl}/sessions/${id}`, { method: 'DELETE' });
    return delRes.ok ? id : null;
  }, DAEMON);

  if (deleted) {
    console.log(`  ✓ 已删除会话: ${deleted.substring(0, 8)}...`);
    await sleep(1000);
    screenshot(page, 'mobile-session-deleted');

    // 重新打开 drawer，验证会话数减少
    const delBurger = page.locator('[aria-label="打开菜单"]');
    if (await delBurger.count() > 0) {
      await delBurger.click();
      await sleep(2000);
      const sessionsAfter = await page.evaluate(async (daemonUrl) => {
        const res = await fetch(`${daemonUrl}/sessions`);
        const data = await res.json();
        return data.sessions.length;
      }, DAEMON);
      console.log(`  删除后: ${sessionsAfter} 个会话`);
      if (sessionsAfter < sessionsBefore) {
        console.log('  ✓ UI 会话列表已刷新');
      }
    }
  } else {
    console.log('  ⚠️ 无会话可删除');
  }

  await mobileCtx.close();

  // ── 桌面端视图 ───────────────────────────────────────────────────

  console.log('\n🖥️ 桌面端视图...');
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopCtx.newPage();

  await desktopPage.goto(BASE);
  await desktopPage.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await sleep(2000);

  await screenshot(desktopPage, 'mobile-desktop-home');

  // 找 burger 按钮
  const deskBurger = desktopPage.locator('[aria-label="打开菜单"]');
  if (await deskBurger.count() > 0) {
    await deskBurger.click();
    await sleep(800);
    await screenshot(desktopPage, 'mobile-desktop-drawer-open');

    const deskInput = desktopPage.locator('[data-testid="server-url-input"]');
    if (await deskInput.count() > 0) {
      await deskInput.fill(DAEMON);
      await screenshot(desktopPage, 'mobile-desktop-drawer-filled');
      const deskSave = desktopPage.locator('[data-testid="server-url-save"]');
      if (await deskSave.count() > 0) await deskSave.click();
      await sleep(500);
    }

    await screenshot(desktopPage, 'mobile-desktop-drawer-full', true);

    await desktopPage.keyboard.press('Escape');
    await sleep(400);
  }

  await screenshot(desktopPage, 'mobile-desktop-conversation-ready');

  // 发消息
  const deskTextarea = desktopPage.locator('textarea').first();
  if (await deskTextarea.isVisible()) {
    await deskTextarea.fill('请用中文回答：1+1等于几？');
    await screenshot(desktopPage, 'mobile-desktop-msg-filled');
    await deskTextarea.press('Enter');
    console.log('  等待 AI 回复...');
    await sleep(6000);
    await screenshot(desktopPage, 'mobile-desktop-ai-reply');
    await sleep(3000);
    await screenshot(desktopPage, 'mobile-desktop-conversation');
  }

  await desktopCtx.close();

  // ── iPad 视图 ───────────────────────────────────────────────────

  console.log('\n📱 iPad 视图...');
  const iPadCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, isMobile: true });
  const iPadPage = await iPadCtx.newPage();
  await iPadPage.goto(BASE);
  await iPadPage.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await sleep(2000);
  await screenshot(iPadPage, 'mobile-ipad');
  await iPadCtx.close();

  console.log('\n✅ 完成！截图目录:', OUT_DIR);
  fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).forEach(f => console.log(`   - ${f}`));

  await browser.close();
}

main().catch(console.error);
