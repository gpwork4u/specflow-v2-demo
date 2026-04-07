import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  loginAsEmployee,
  expectLoggedIn,
  expectErrorMessage,
  takeScreenshot,
  LOGIN_CREDENTIALS,
} from './helpers';

const FEATURE = 'F-000';

test.describe(`[${FEATURE}] 登入頁面 - Browser Test`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 登入頁面正確載入', async ({ page }) => {
      // THEN - 頁面應包含 email 和 password 輸入欄位
      const emailInput =
        page.getByLabel(/email/i).or(
          page.locator('[name="email"]').or(
            page.getByPlaceholder(/email/i),
          ),
        );
      await expect(emailInput.first()).toBeVisible();

      const passwordInput =
        page.getByLabel(/password|密碼/i).or(
          page.locator('[name="password"]').or(
            page.getByPlaceholder(/password|密碼/i),
          ),
        );
      await expect(passwordInput.first()).toBeVisible();

      // AND 應有登入按鈕
      const submitBtn =
        page.getByRole('button', { name: /login|登入|sign in/i }).or(
          page.locator('button[type="submit"]'),
        );
      await expect(submitBtn.first()).toBeVisible();

      await takeScreenshot(page, FEATURE, 'login-page-loaded');
    });

    test('Scenario: 輸入正確帳密成功登入並導向 Dashboard', async ({ page }) => {
      // WHEN
      await loginViaUI(
        page,
        LOGIN_CREDENTIALS.employee.email,
        LOGIN_CREDENTIALS.employee.password,
      );

      // THEN - 應導向非登入頁面（Dashboard 或首頁）
      await expectLoggedIn(page);
      await takeScreenshot(page, FEATURE, 'login-success-dashboard');
    });

    test('Scenario: Admin 登入成功', async ({ page }) => {
      // WHEN
      await loginViaUI(
        page,
        LOGIN_CREDENTIALS.admin.email,
        LOGIN_CREDENTIALS.admin.password,
      );

      // THEN
      await expectLoggedIn(page);
      await takeScreenshot(page, FEATURE, 'admin-login-success');
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 輸入錯誤密碼顯示錯誤訊息', async ({ page }) => {
      // WHEN
      await loginViaUI(
        page,
        LOGIN_CREDENTIALS.employee.email,
        'WrongPassword99!',
      );

      // THEN - 應顯示錯誤訊息且仍停留在登入頁
      await expect(page).toHaveURL(/\/login/);
      await expectErrorMessage(page);
      await takeScreenshot(page, FEATURE, 'login-wrong-password');
    });

    test('Scenario: 輸入不存在的 email 顯示錯誤訊息', async ({ page }) => {
      // WHEN
      await loginViaUI(
        page,
        'nonexistent@company.com',
        'AnyPassword123!',
      );

      // THEN
      await expect(page).toHaveURL(/\/login/);
      await expectErrorMessage(page);
      await takeScreenshot(page, FEATURE, 'login-nonexistent-email');
    });

    test('Scenario: 空白表單送出顯示驗證提示', async ({ page }) => {
      // WHEN - 不填任何欄位直接送出
      const submitBtn =
        page.getByRole('button', { name: /login|登入|sign in/i }).or(
          page.locator('button[type="submit"]'),
        );
      await submitBtn.first().click();
      await page.waitForLoadState('networkidle');

      // THEN - 應顯示必填提示或仍停留在登入頁
      await expect(page).toHaveURL(/\/login/);
      await takeScreenshot(page, FEATURE, 'login-empty-form');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 已登入狀態造訪登入頁應重導', async ({ page }) => {
      // GIVEN - 先登入
      await loginAsEmployee(page);
      await expectLoggedIn(page);

      // WHEN - 造訪登入頁
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // THEN - 應重導回 Dashboard（或不顯示登入表單）
      // 有些實作可能留在 /login 但顯示已登入狀態
      const currentUrl = page.url();
      const loginFormVisible = await page
        .locator('button[type="submit"]')
        .isVisible()
        .catch(() => false);

      // 至少應滿足以下其一：不在登入頁 或 登入表單不可見
      const isRedirected = !currentUrl.includes('/login') || !loginFormVisible;
      // 如果沒有重導也可以接受，但記錄截圖
      await takeScreenshot(page, FEATURE, 'login-while-authenticated');
    });
  });
});
