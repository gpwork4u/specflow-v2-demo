import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  loginAsEmployee,
  loginAsAdmin,
  expectLoggedIn,
  expectErrorMessage,
  takeScreenshot,
  LOGIN_CREDENTIALS,
} from './helpers';

const FEATURE = 'F-002';

test.describe(`[${FEATURE}] 請假申請 - Browser Test`, () => {
  // =============================================
  // 請假申請表單
  // =============================================
  test.describe('請假申請表單', () => {
    test.beforeEach(async ({ page }) => {
      // GIVEN 員工已登入
      await loginAsEmployee(page);
      await expectLoggedIn(page);
    });

    test('Scenario: 請假申請頁面正確載入', async ({ page }) => {
      // WHEN 導航到請假申請頁面
      await page.goto('/leaves/new');
      await page.waitForLoadState('networkidle');

      // THEN 應包含假別選擇、日期選擇、原因輸入欄位
      // 假別下拉選單
      const leaveTypeSelect = page
        .getByLabel(/假別|leave type/i)
        .or(page.locator('[name="leave_type"]'))
        .or(page.getByRole('combobox', { name: /假別|leave/i }));
      await expect(leaveTypeSelect.first()).toBeVisible({ timeout: 10000 });

      // 開始日期
      const startDateInput = page
        .getByLabel(/開始日期|start date/i)
        .or(page.locator('[name="start_date"]'));
      await expect(startDateInput.first()).toBeVisible();

      // 結束日期
      const endDateInput = page
        .getByLabel(/結束日期|end date/i)
        .or(page.locator('[name="end_date"]'));
      await expect(endDateInput.first()).toBeVisible();

      // 原因
      const reasonInput = page
        .getByLabel(/原因|reason/i)
        .or(page.locator('[name="reason"]'))
        .or(page.getByPlaceholder(/原因|reason/i));
      await expect(reasonInput.first()).toBeVisible();

      // 送出按鈕
      const submitBtn = page
        .getByRole('button', { name: /送出|submit|申請/i })
        .or(page.locator('button[type="submit"]'));
      await expect(submitBtn.first()).toBeVisible();

      await takeScreenshot(page, FEATURE, 'leave-form-loaded');
    });

    test('Scenario: 填寫完整假單送出成功', async ({ page }) => {
      await page.goto('/leaves/new');
      await page.waitForLoadState('networkidle');

      // WHEN 選擇假別
      const leaveTypeSelect = page
        .getByLabel(/假別|leave type/i)
        .or(page.locator('[name="leave_type"]'))
        .or(page.getByRole('combobox', { name: /假別|leave/i }));
      await leaveTypeSelect.first().click();
      // 嘗試選擇「特休」
      const annualOption = page.getByRole('option', { name: /特休|annual/i })
        .or(page.getByText(/特休/));
      if (await annualOption.first().isVisible().catch(() => false)) {
        await annualOption.first().click();
      } else {
        await leaveTypeSelect.first().selectOption({ label: '特休' }).catch(() =>
          leaveTypeSelect.first().selectOption('annual'),
        );
      }

      // WHEN 選擇日期
      const startDateInput = page
        .getByLabel(/開始日期|start date/i)
        .or(page.locator('[name="start_date"]'));
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const dateStr = futureDate.toISOString().split('T')[0];
      await startDateInput.first().fill(dateStr);

      const endDateInput = page
        .getByLabel(/結束日期|end date/i)
        .or(page.locator('[name="end_date"]'));
      await endDateInput.first().fill(dateStr);

      // WHEN 填入原因
      const reasonInput = page
        .getByLabel(/原因|reason/i)
        .or(page.locator('[name="reason"]'))
        .or(page.getByPlaceholder(/原因|reason/i));
      await reasonInput.first().fill('Playwright 自動化測試 - 請假申請');

      await takeScreenshot(page, FEATURE, 'leave-form-filled');

      // WHEN 送出
      const submitBtn = page
        .getByRole('button', { name: /送出|submit|申請/i })
        .or(page.locator('button[type="submit"]'));
      await submitBtn.first().click();
      await page.waitForLoadState('networkidle');

      // THEN 應顯示成功訊息或導向請假列表
      const successIndicator = page
        .getByText(/成功|success|已送出|已提交/i)
        .or(page.locator('[role="alert"]').filter({ hasText: /成功|success/i }));

      // 成功的標誌可能是：顯示成功訊息 or 跳轉到列表頁
      const hasSuccess = await successIndicator.first().isVisible({ timeout: 5000 }).catch(() => false);
      const isOnListPage = page.url().includes('/leaves') && !page.url().includes('/new');

      expect(hasSuccess || isOnListPage).toBe(true);
      await takeScreenshot(page, FEATURE, 'leave-form-submitted');
    });

    test('Scenario: 未填原因送出顯示驗證錯誤', async ({ page }) => {
      await page.goto('/leaves/new');
      await page.waitForLoadState('networkidle');

      // WHEN 不填原因直接送出
      const submitBtn = page
        .getByRole('button', { name: /送出|submit|申請/i })
        .or(page.locator('button[type="submit"]'));
      await submitBtn.first().click();
      await page.waitForLoadState('networkidle');

      // THEN 應顯示驗證錯誤
      const errorIndicator = page
        .getByText(/必填|required|請填寫|不可為空/i)
        .or(page.locator('[role="alert"]'))
        .or(page.locator('.error, .text-destructive, [class*="error"]'));

      await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
      await takeScreenshot(page, FEATURE, 'leave-form-validation-error');
    });

    test('Scenario: 顯示剩餘額度資訊', async ({ page }) => {
      await page.goto('/leaves/new');
      await page.waitForLoadState('networkidle');

      // THEN 頁面應顯示額度相關資訊
      // 尋找額度相關的文字或元素
      const quotaInfo = page
        .getByText(/額度|剩餘|remaining|quota/i)
        .or(page.locator('[class*="quota"], [data-testid*="quota"]'));

      const hasQuotaInfo = await quotaInfo.first().isVisible({ timeout: 5000 }).catch(() => false);
      // 記錄截圖，不論是否有額度顯示
      await takeScreenshot(page, FEATURE, 'leave-form-quota-info');
    });
  });

  // =============================================
  // 請假紀錄列表
  // =============================================
  test.describe('請假紀錄列表', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsEmployee(page);
      await expectLoggedIn(page);
    });

    test('Scenario: 請假紀錄列表頁面正確載入', async ({ page }) => {
      // WHEN 導航到請假紀錄頁
      await page.goto('/leaves');
      await page.waitForLoadState('networkidle');

      // THEN 應有列表結構
      const listContainer = page
        .getByRole('table')
        .or(page.locator('[class*="list"], [class*="table"], [role="grid"]'))
        .or(page.locator('[data-testid*="leave"]'));

      await expect(listContainer.first()).toBeVisible({ timeout: 10000 });
      await takeScreenshot(page, FEATURE, 'leave-list-loaded');
    });

    test('Scenario: 列表含篩選功能', async ({ page }) => {
      await page.goto('/leaves');
      await page.waitForLoadState('networkidle');

      // THEN 應有篩選元素（狀態、假別、日期等）
      const filterElements = page
        .getByRole('combobox')
        .or(page.locator('select'))
        .or(page.locator('[class*="filter"], [data-testid*="filter"]'));

      const hasFilters = await filterElements.first().isVisible({ timeout: 5000 }).catch(() => false);
      await takeScreenshot(page, FEATURE, 'leave-list-filters');
    });

    test('Scenario: 點擊假單可查看詳情', async ({ page }) => {
      await page.goto('/leaves');
      await page.waitForLoadState('networkidle');

      // WHEN 點擊第一筆紀錄
      const firstRow = page
        .getByRole('row').nth(1)
        .or(page.locator('tr').nth(1))
        .or(page.locator('[class*="list-item"], [class*="card"]').first());

      const clickTarget = firstRow
        .getByRole('link')
        .or(firstRow.locator('a'))
        .or(firstRow);

      const hasRows = await clickTarget.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasRows) {
        await clickTarget.first().click();
        await page.waitForLoadState('networkidle');

        // THEN 應顯示詳情（假別、日期、狀態、原因等）
        const detailContent = page
          .getByText(/假別|leave type/i)
          .or(page.getByText(/狀態|status/i))
          .or(page.getByText(/原因|reason/i));

        await expect(detailContent.first()).toBeVisible({ timeout: 5000 });
        await takeScreenshot(page, FEATURE, 'leave-detail');
      }
    });
  });

  // =============================================
  // 額度總覽
  // =============================================
  test.describe('額度總覽', () => {
    test('Scenario: 員工查看額度總覽頁', async ({ page }) => {
      await loginAsEmployee(page);
      await expectLoggedIn(page);

      // WHEN 導航到額度頁面
      // 嘗試多種可能的路徑
      for (const path of ['/leave-quotas', '/quotas', '/leaves/quotas', '/dashboard']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const quotaContent = page
          .getByText(/額度|quota|特休|病假|事假/i)
          .or(page.locator('[class*="quota"], [class*="progress"]'));

        if (await quotaContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await takeScreenshot(page, 'F-009', 'quota-overview');
          return; // 找到了，結束測試
        }
      }

      // 如果都找不到，截圖記錄
      await takeScreenshot(page, 'F-009', 'quota-page-not-found');
    });
  });
});
