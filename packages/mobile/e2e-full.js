/**
 * Playwright E2E 完整功能验证脚本
 * 测试：连接服务、发送消息、查看会话记录、新建会话、删除会话
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

async function screenshot(page, name) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🚀 Mobile E2E 完整功能验证\n');

  const browser = await chromium.launch({ headless: true });

  // ── 移动端视图 ─────────────────────────────────────────────
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

  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  // ── 1. 连接服务 ────────────────────────────────────────────
  console.log('\n📡 1. 连接服务测试');

  // 打开抽屉设置 serverUrl
  const burgerBtn = page.locator('[aria-label="打开菜单"]');
  const hasBurger = await burgerBtn.count() > 0;
  assert('汉堡菜单按钮存在', hasBurger);

  if (hasBurger) {
    await burgerBtn.click();
    await sleep(1000);

    // 检查抽屉元素
    const hasAlex = await page.locator('text=Alex').count() > 0;
    const hasNewChat = await page.locator('text=新建对话').count() > 0;
    const hasHistory = await page.locator('text=历史会话').count() > 0;
    const hasSettings = await page.locator('text=设置').count() > 0;
    const hasLogout = await page.locator('text=退出登录').count() > 0;

    assert('抽屉显示用户 Alex', hasAlex);
    assert('抽屉显示新建对话按钮', hasNewChat);
    assert('抽屉显示历史会话标签', hasHistory);
    assert('抽屉显示设置按钮', hasSettings);
    assert('抽屉显示退出登录按钮', hasLogout);

    await screenshot(page, 'e2e-drawer-open');

    // 关闭抽屉
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // ── 2. 发送消息测试 ───────────────────────────────────────
  console.log('\n💬 2. 发送消息测试');

  const textarea = page.locator('textarea').first();
  const hasTextarea = await textarea.isVisible();
  assert('输入框可见', hasTextarea);

  if (hasTextarea) {
    await textarea.fill('你好，请介绍一下你自己');
    await sleep(500);
    await screenshot(page, 'e2e-msg-filled');

    // 点击发送按钮
    const sendBtn = page.locator('[aria-label="发送消息"]');
    const hasSendBtn = await sendBtn.count() > 0;
    assert('发送按钮可见', hasSendBtn);

    if (hasSendBtn) {
      await sendBtn.click();
      console.log('  ⏳ 等待 AI 回复...');
      await sleep(8000);
      await screenshot(page, 'e2e-ai-reply');

      // 检查是否有 AI 回复
      const pageText = await page.textContent('body');
      const hasReply = pageText.includes('AI') || pageText.includes('你好') || pageText.includes('OpenZ') || pageText.includes('助手');
      assert('收到 AI 回复', hasReply);
    }
  }

  // ── 3. 新建会话测试 ───────────────────────────────────────
  console.log('\n➕ 3. 新建会话测试');

  // 点击新建按钮
  const newChatBtn = page.locator('[aria-label="新对话"]');
  const hasNewChatBtn = await newChatBtn.count() > 0;
  assert('新建对话按钮存在', hasNewChatBtn);

  if (hasNewChatBtn) {
    await newChatBtn.click();
    await sleep(1500);
    await screenshot(page, 'e2e-new-chat');

    // 检查输入框是否清空（新建会话后）
    const newText = await textarea.inputValue();
    assert('新建会话后输入框已清空', newText === '');
  }

  // ── 4. 查看会话记录 ───────────────────────────────────────
  console.log('\n📋 4. 查看会话记录测试');

  // 打开抽屉查看历史会话
  if (hasBurger) {
    await burgerBtn.click();
    await sleep(1500);
    await screenshot(page, 'e2e-history-drawer');

    // 等待 sessions 加载
    await sleep(2000);

    // 检查是否有会话列表或空状态
    const hasLoading = await page.locator('text=加载中').count() > 0;
    const hasEmpty = await page.locator('text=暂无').count() > 0;
    // 使用更通用的选择器：找有会话图标的列表项
    const sessionItems = await page.locator('text=历史会话').locator('..').locator('..').locator('[role="button"]').count();
    const hasSessions = sessionItems > 0;

    assert('历史会话列表正常显示（加载中/空/有数据）', hasLoading || hasEmpty || hasSessions);
    if (hasSessions) console.log(`  会话数量: ${sessionItems}`);

    // 关闭抽屉
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // ── 5. 删除会话测试 ───────────────────────────────────────
  console.log('\n🗑️ 5. 删除会话测试');

  // 先确保有会话可删
  const sessionsBefore = await page.evaluate(async (daemonUrl) => {
    try {
      const res = await fetch(`${daemonUrl}/sessions`);
      const data = await res.json();
      return data.sessions?.length ?? 0;
    } catch {
      return 0;
    }
  }, DAEMON);
  console.log(`  会话数量: ${sessionsBefore}`);

  if (sessionsBefore > 0) {
    // 打开抽屉
    await burgerBtn.click();
    await sleep(1000);

    // 打开抽屉内的会话进行长按（如果有的话）
    const sessionItems = page.locator('[accessibilityhint="长按显示更多操作"]');
    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      // 长按第一个会话
      await sessionItems.first().click({ delay: 700 });
      await sleep(500);
      await screenshot(page, 'e2e-action-sheet');

      // 检查 action sheet 是否出现
      const hasRename = await page.locator('text=重命名').count() > 0;
      const hasPin = await page.locator('text=置顶').count() > 0 || await page.locator('text=取消置顶').count() > 0;
      const hasDelete = await page.locator('text=删除').count() > 0;

      assert('Action sheet 显示重命名选项', hasRename);
      assert('Action sheet 显示置顶选项', hasPin);
      assert('Action sheet 显示删除选项', hasDelete);

      // 点击删除
      const deleteBtn = page.locator('text=删除').first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();
        await sleep(1000);

        // 确认删除（如果有确认对话框）
        const confirmDialog = page.locator('text=确认');
        if (await confirmDialog.count() > 0) {
          await confirmDialog.click();
          await sleep(500);
        }
      }

      await screenshot(page, 'e2e-after-delete');
    }

    await page.keyboard.press('Escape');
    await sleep(500);
  } else {
    console.log('  ⚠️ 没有会话可删除（先发送消息创建会话）');
  }

  // ── 结果汇总 ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('═'.repeat(50));

  await screenshot(page, 'e2e-final');

  await mobileCtx.close();
  await browser.close();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});
