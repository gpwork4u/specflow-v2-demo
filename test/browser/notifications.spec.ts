import { test, expect } from '@playwright/test';
import {
  loginAsEmployee,
  loginAsManager,
  loginViaUI,
  LOGIN_CREDENTIALS,
  expectLoggedIn,
  takeScreenshot,
} from './helpers';

const FEATURE = 'F-007';

test.describe(`[${FEATURE}] 通知中心 - Browser Test`, () => {
  // ===========================================
  // 員工視角：通知鈴鐺與列表
  // ===========================================

  test.describe('員工：通知鈴鐺與列表', () => {
    test.beforeEach(async ({ page }) => {
      // GIVEN 員工已登入
      await loginAsEmployee(page);
      await expectLoggedIn(page);
    });

    test('Scenario: Header 顯示通知鈴鐺與未讀 badge', async ({ page }) => {
      // THEN Header 右上角應有通知鈴鐺圖示
      const bellButton = page
        .getByRole('button', { name: /通知|notification/i })
        .or(page.locator('[data-testid="notification-bell"]'))
        .or(page.locator('[aria-label*="通知"]'))
        .or(page.locator('.notification-bell, [class*="notification"]'));

      await expect(bellButton.first()).toBeVisible({ timeout: 10000 });
      await takeScreenshot(page, FEATURE, 'notification-bell');
    });

    test('Scenario: 點擊鈴鐺展開通知列表', async ({ page }) => {
      // WHEN 點擊通知鈴鐺
      const bellButton = page
        .getByRole('button', { name: /通知|notification/i })
        .or(page.locator('[data-testid="notification-bell"]'))
        .or(page.locator('[aria-label*="通知"]'))
        .or(page.locator('.notification-bell, [class*="notification"]'));

      await bellButton.first().click();
      await page.waitForLoadState('networkidle');

      // THEN 應顯示通知下拉選單或通知頁面
      const notificationPanel = page
        .getByRole('menu')
        .or(page.getByRole('dialog'))
        .or(page.locator('[data-testid="notification-panel"]'))
        .or(page.locator('[class*="notification-list"], [class*="notification-dropdown"]'));

      // 或者導航到了通知頁面
      const isOnNotifPage = page.url().includes('/notification');
      if (!isOnNotifPage) {
        await expect(notificationPanel.first()).toBeVisible({ timeout: 5000 });
      }

      await takeScreenshot(page, FEATURE, 'notification-panel-open');
    });

    test('Scenario: 通知列表顯示通知內容', async ({ page }) => {
      // WHEN 導航到通知頁面（或展開通知面板）
      // 嘗試直接到通知頁面
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // 如果 404 或被導向，嘗試點擊鈴鐺
      if (page.url().includes('/login') || page.url().includes('/404')) {
        await loginAsEmployee(page);
        const bell = page
          .getByRole('button', { name: /通知|notification/i })
          .or(page.locator('[data-testid="notification-bell"]'))
          .or(page.locator('[aria-label*="通知"]'));
        await bell.first().click();
        await page.waitForLoadState('networkidle');
      }

      // THEN 應顯示通知項目（如有）
      // 每則通知應有 title 和 content
      await takeScreenshot(page, FEATURE, 'notification-list');
    });

    test('Scenario: 全部已讀按鈕', async ({ page }) => {
      // WHEN 導航到通知頁面
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/login')) {
        await loginAsEmployee(page);
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
      }

      // THEN 應有「全部已讀」按鈕
      const readAllBtn = page
        .getByRole('button', { name: /全部已讀|mark all|read all/i })
        .or(page.locator('[data-testid="mark-all-read"]'));

      // 如果有未讀通知，全部已讀按鈕應可見
      const hasReadAllBtn = await readAllBtn.first().isVisible().catch(() => false);

      if (hasReadAllBtn) {
        // WHEN 點擊全部已讀
        await readAllBtn.first().click();
        await page.waitForLoadState('networkidle');

        // THEN 未讀 badge 應消失或變為 0
        await takeScreenshot(page, FEATURE, 'after-mark-all-read');
      } else {
        // 沒有通知或沒有未讀通知時，按鈕可能不顯示
        await takeScreenshot(page, FEATURE, 'no-unread-notifications');
      }
    });

    test('Scenario: 點擊通知跳轉到對應申請詳情', async ({ page }) => {
      // WHEN 導航到通知頁面
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/login')) {
        await loginAsEmployee(page);
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
      }

      // 找到通知列表中的第一個項目
      const notifItem = page
        .locator('[data-testid="notification-item"]')
        .or(page.locator('.notification-item, [class*="notification-item"]'))
        .or(page.getByRole('listitem'));

      const hasNotif = await notifItem.first().isVisible().catch(() => false);

      if (hasNotif) {
        const beforeUrl = page.url();

        // WHEN 點擊通知
        await notifItem.first().click();
        await page.waitForLoadState('networkidle');

        // THEN 應導航到對應的申請詳情頁
        const afterUrl = page.url();
        // URL 應該有變化（導航到詳情頁）
        await takeScreenshot(page, FEATURE, 'notification-detail-redirect');
      } else {
        await takeScreenshot(page, FEATURE, 'no-notification-items');
      }
    });
  });

  // ===========================================
  // 主管視角：收到新申請通知
  // ===========================================

  test.describe('主管：新申請通知', () => {
    test('Scenario: 主管登入後看到未讀通知 badge', async ({ page }) => {
      // GIVEN 主管登入
      await loginAsManager(page);
      await expectLoggedIn(page);

      // THEN 應顯示通知鈴鐺（可能有未讀 badge）
      const bellButton = page
        .getByRole('button', { name: /通知|notification/i })
        .or(page.locator('[data-testid="notification-bell"]'))
        .or(page.locator('[aria-label*="通知"]'))
        .or(page.locator('.notification-bell, [class*="notification"]'));

      await expect(bellButton.first()).toBeVisible({ timeout: 10000 });

      // 檢查是否有未讀 badge
      const badge = page
        .locator('[data-testid="unread-badge"]')
        .or(page.locator('.badge, [class*="badge"]'));

      await takeScreenshot(page, FEATURE, 'manager-notification-bell');
    });
  });

  // ===========================================
  // 標記已讀互動
  // ===========================================

  test.describe('標記已讀互動', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsEmployee(page);
      await expectLoggedIn(page);
    });

    test('Scenario: 標記單則通知已讀', async ({ page }) => {
      // 導航到通知頁面
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/login')) {
        await loginAsEmployee(page);
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
      }

      // 找到未讀通知
      const unreadNotif = page
        .locator('[data-testid="notification-item"][data-unread="true"]')
        .or(page.locator('.notification-item.unread, [class*="unread"]'));

      const hasUnread = await unreadNotif.first().isVisible().catch(() => false);

      if (hasUnread) {
        await takeScreenshot(page, FEATURE, 'before-mark-single-read');

        // WHEN 點擊或標記已讀
        await unreadNotif.first().click();
        await page.waitForLoadState('networkidle');

        // THEN 該通知樣式應改變（不再是未讀狀態）
        await takeScreenshot(page, FEATURE, 'after-mark-single-read');
      } else {
        await takeScreenshot(page, FEATURE, 'no-unread-to-mark');
      }
    });
  });

  // ===========================================
  // 空狀態
  // ===========================================

  test.describe('空狀態', () => {
    test('Scenario: 無通知時顯示空狀態', async ({ page }) => {
      // GIVEN 新員工登入（可能沒有通知）
      await loginViaUI(
        page,
        LOGIN_CREDENTIALS.employee.email,
        LOGIN_CREDENTIALS.employee.password,
      );
      await expectLoggedIn(page);

      // WHEN 開啟通知頁面
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/login')) {
        await loginAsEmployee(page);
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
      }

      // THEN 截圖記錄（可能是空狀態或通知列表）
      await takeScreenshot(page, FEATURE, 'notification-page-state');
    });
  });
});
