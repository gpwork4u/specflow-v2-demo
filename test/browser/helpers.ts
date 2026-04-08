import { Page, expect } from '@playwright/test';

/**
 * Browser Test Helpers
 * 共用的頁面操作和驗證函式
 */

/** 預設登入帳密 */
export const LOGIN_CREDENTIALS = {
  admin: { email: 'admin@company.com', password: 'Admin123!@#' },
  employee: { email: 'employee@company.com', password: 'Employee123!' },
  manager: { email: 'manager@company.com', password: 'Manager123!' },
};

/**
 * 透過 UI 登入
 * 嘗試多種可能的選擇器以適應不同的 UI 實作
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // 填入 email - 嘗試多種選擇器
  const emailInput =
    page.getByLabel(/email/i).or(
      page.locator('[name="email"]').or(
        page.getByPlaceholder(/email/i),
      ),
    );
  await emailInput.first().fill(email);

  // 填入密碼
  const passwordInput =
    page.getByLabel(/password|密碼/i).or(
      page.locator('[name="password"]').or(
        page.getByPlaceholder(/password|密碼/i),
      ),
    );
  await passwordInput.first().fill(password);

  // 點擊登入按鈕
  const submitBtn =
    page.getByRole('button', { name: /login|登入|sign in/i }).or(
      page.locator('button[type="submit"]'),
    );
  await submitBtn.first().click();

  // 等待導航完成（離開登入頁）
  await page.waitForLoadState('networkidle');
}

/**
 * 以員工身份登入
 */
export async function loginAsEmployee(page: Page): Promise<void> {
  await loginViaUI(
    page,
    LOGIN_CREDENTIALS.employee.email,
    LOGIN_CREDENTIALS.employee.password,
  );
}

/**
 * 以管理員身份登入
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginViaUI(
    page,
    LOGIN_CREDENTIALS.admin.email,
    LOGIN_CREDENTIALS.admin.password,
  );
}

/**
 * 驗證已成功登入（不在登入頁）
 */
export async function expectLoggedIn(page: Page): Promise<void> {
  // 確認不再是登入頁
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * 驗證顯示錯誤訊息
 */
export async function expectErrorMessage(page: Page, pattern?: RegExp): Promise<void> {
  const errorLocator = pattern
    ? page.getByText(pattern)
    : page.locator('[role="alert"], .error, .text-destructive, [class*="error"]').first();
  await expect(errorLocator).toBeVisible({ timeout: 5000 });
}

/**
 * 截圖工具
 */
export async function takeScreenshot(
  page: Page,
  feature: string,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: `screenshots/${feature}/${name}.png`,
    fullPage: true,
  });
}
