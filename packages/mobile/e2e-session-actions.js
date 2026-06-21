/**
 * Playwright E2E 会话长按操作测试
 * 测试：长按会话 → action sheet → 重命名/置顶/删除
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
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🧪 会话长按操作 E2E 测试\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForFunction(() => document.getElementById('root')?.children?.length > 0, { timeout: 15000 });
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

  // 打开抽屉
  await page.locator('[aria-label="打开菜单"]').click();
  await sleep(2000);
  await screenshot(page, 'e2e-longpress-1-drawer-open');

  // 找会话项 - 使用文本和时间标签来定位
  // 会话项包含 "新对话" 文本和 "分钟前/小时前/昨天" 等时间标签
  const sessionItems = page.locator('text=新对话').locator('..').locator('..');
  const itemCount = await page.locator('text=分钟前').count();
  console.log(`\n找到 ${itemCount} 个会话项（通过时间标签）`);

  assert('会话列表有数据', itemCount > 0);

  if (itemCount > 0) {
    // 找到包含时间的会话行并点击
    const timeLabels = page.locator('text=分钟前');

    // 长按第一个会话（通过时间标签的父元素）
    console.log('  长按第一个会话项...');
    await timeLabels.first().click({ delay: 700 });
    await sleep(800);
    await screenshot(page, 'e2e-longpress-2-action-sheet');

    // 检查 action sheet 元素
    const hasRename = await page.locator('text=重命名').count() > 0;
    const hasPin = await page.locator('text=置顶会话').count() > 0 || await page.locator('text=取消置顶').count() > 0;
    const hasDelete = await page.locator('text=删除').count() > 0;

    assert('Action sheet 显示"重命名"选项', hasRename);
    assert('Action sheet 显示"置顶会话"选项', hasPin);
    assert('Action sheet 显示"删除"选项', hasDelete);

    // 测试重命名功能
    if (hasRename) {
      await page.locator('text=重命名').click();
      await sleep(500);

      // 检查重命名弹窗
      const hasRenameModal = await page.locator('text=重命名会话').count() > 0;
      const hasInput = await page.locator('input').count() > 0 || await page.locator('textinput').count() > 0;
      const hasCancel = await page.locator('text=取消').count() > 0;
      const hasConfirm = await page.locator('text=确定').count() > 0;

      assert('重命名弹窗显示标题', hasRenameModal);
      assert('重命名弹窗有输入框', hasInput);
      assert('重命名弹窗有取消按钮', hasCancel);
      assert('重命名弹窗有确定按钮', hasConfirm);

      await screenshot(page, 'e2e-longpress-3-rename-modal');

      // 点击取消关闭弹窗
      await page.locator('text=取消').click();
      await sleep(500);
    }

    // 再次长按测试置顶
    await timeLabels.first().click({ delay: 700 });
    await sleep(800);

    if (hasPin) {
      // 点击置顶
      const pinText = await page.locator('text=置顶会话').count() > 0 ? '置顶会话' : '取消置顶';
      await page.locator(`text=${pinText}`).click();
      await sleep(500);
      await screenshot(page, 'e2e-longpress-4-after-pin');
      console.log(`  ✅ 置顶操作完成`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('═'.repeat(50));

  await ctx.close();
  await browser.close();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});
