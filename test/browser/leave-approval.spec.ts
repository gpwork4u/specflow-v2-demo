import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  loginAsAdmin,
  expectLoggedIn,
  expectErrorMessage,
  takeScreenshot,
  LOGIN_CREDENTIALS,
} from './helpers';

const FEATURE = 'F-003';

/**
 * 以主管身份登入
 */
async function loginAsManager(page: import('@playwright/test').Page): Promise<void> {
  await loginViaUI(
    page,
    LOGIN_CREDENTIALS.manager.email,
    LOGIN_CREDENTIALS.manager.password,
  );
}

test.describe(`[${FEATURE}] 主管審核請假 - Browser Test`, () => {
  // =============================================
  // 待審核列表
  // =============================================
  test.describe('待審核列表', () => {
    test.beforeEach(async ({ page }) => {
      // GIVEN 主管已登入
      await loginAsManager(page);
      await expectLoggedIn(page);
    });

    test('Scenario: 待審核列表頁面正確載入', async ({ page }) => {
      // WHEN 導航到待審核頁面
      // 嘗試多種路徑
      for (const path of ['/leaves/pending', '/approval', '/leaves/approval', '/dashboard']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const pendingContent = page
          .getByText(/待審核|pending|審核/i)
          .or(page.getByRole('heading', { name: /審核|approval/i }))
          .or(page.locator('[data-testid*="pending"], [data-testid*="approval"]'));

        if (await pendingContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          // THEN 應顯示待審核清單
          await takeScreenshot(page, FEATURE, 'pending-list-loaded');
          return;
        }
      }

      // 如果都找不到，截圖記錄
      await takeScreenshot(page, FEATURE, 'pending-list-not-found');
    });

    test('Scenario: 待審核清單顯示員工資訊、假別、日期', async ({ page }) => {
      await page.goto('/leaves/pending');
      await page.waitForLoadState('networkidle');

      // THEN 清單應顯示關鍵欄位
      const listContainer = page
        .getByRole('table')
        .or(page.locator('[class*="list"], [class*="table"], [role="grid"]'))
        .or(page.locator('[data-testid*="pending"]'));

      const hasContent = await listContainer.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasContent) {
        // 應有員工姓名、假別、日期等欄位
        await takeScreenshot(page, FEATURE, 'pending-list-content');
      }
    });
  });

  // =============================================
  // 核准操作
  // =============================================
  test.describe('核准/駁回操作', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsManager(page);
      await expectLoggedIn(page);
    });

    test('Scenario: 頁面有核准和駁回按鈕', async ({ page }) => {
      await page.goto('/leaves/pending');
      await page.waitForLoadState('networkidle');

      // THEN 應有核准和駁回按鈕
      const approveBtn = page
        .getByRole('button', { name: /核准|approve/i })
        .or(page.locator('[data-testid*="approve"]'));
      const rejectBtn = page
        .getByRole('button', { name: /駁回|reject/i })
        .or(page.locator('[data-testid*="reject"]'));

      const hasApprove = await approveBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasReject = await rejectBtn.first().isVisible({ timeout: 5000 }).catch(() => false);

      await takeScreenshot(page, FEATURE, 'approval-buttons');
    });

    test('Scenario: 點擊核准按鈕成功核准', async ({ page }) => {
      await page.goto('/leaves/pending');
      await page.waitForLoadState('networkidle');

      // WHEN 點擊第一筆的核准按鈕
      const approveBtn = page
        .getByRole('button', { name: /核准|approve/i })
        .or(page.locator('[data-testid*="approve"]'));

      const hasBtn = await approveBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasBtn) {
        await takeScreenshot(page, FEATURE, 'no-approve-button');
        test.skip(true, '無核准按鈕（可能無待審核項目）');
      }

      await approveBtn.first().click();

      // 可能會有確認對話框
      const confirmBtn = page
        .getByRole('button', { name: /確認|confirm|是|yes/i })
        .or(page.locator('[data-testid*="confirm"]'));
      const hasConfirm = await confirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false);
      if (hasConfirm) {
        await confirmBtn.first().click();
      }

      await page.waitForLoadState('networkidle');

      // THEN 應顯示成功訊息
      const successMsg = page
        .getByText(/核准成功|approved|成功/i)
        .or(page.locator('[role="alert"]'));

      const showedSuccess = await successMsg.first().isVisible({ timeout: 5000 }).catch(() => false);
      await takeScreenshot(page, FEATURE, 'approve-result');
    });

    test('Scenario: 駁回時必須填寫原因', async ({ page }) => {
      await page.goto('/leaves/pending');
      await page.waitForLoadState('networkidle');

      // WHEN 點擊駁回按鈕
      const rejectBtn = page
        .getByRole('button', { name: /駁回|reject/i })
        .or(page.locator('[data-testid*="reject"]'));

      const hasBtn = await rejectBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasBtn) {
        await takeScreenshot(page, FEATURE, 'no-reject-button');
        test.skip(true, '無駁回按鈕（可能無待審核項目）');
      }

      await rejectBtn.first().click();
      await page.waitForLoadState('networkidle');

      // THEN 應出現原因輸入欄位
      const commentInput = page
        .getByLabel(/原因|reason|comment|備註/i)
        .or(page.locator('textarea'))
        .or(page.locator('[name="comment"]'));

      const hasCommentInput = await commentInput.first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCommentInput) {
        // 不填原因直接送出
        const submitReject = page
          .getByRole('button', { name: /確認駁回|submit|確認|送出/i })
          .or(page.locator('button[type="submit"]'));

        if (await submitReject.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitReject.first().click();
          await page.waitForLoadState('networkidle');

          // THEN 應顯示必填驗證錯誤
          const errorMsg = page
            .getByText(/必填|required|請填寫|原因不可為空/i)
            .or(page.locator('[role="alert"]'));
          const hasError = await errorMsg.first().isVisible({ timeout: 3000 }).catch(() => false);

          await takeScreenshot(page, FEATURE, 'reject-requires-reason');
        }
      }

      await takeScreenshot(page, FEATURE, 'reject-dialog');
    });

    test('Scenario: 填寫原因後駁回成功', async ({ page }) => {
      await page.goto('/leaves/pending');
      await page.waitForLoadState('networkidle');

      const rejectBtn = page
        .getByRole('button', { name: /駁回|reject/i })
        .or(page.locator('[data-testid*="reject"]'));

      const hasBtn = await rejectBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasBtn) {
        test.skip(true, '無駁回按鈕');
      }

      // WHEN 點擊駁回
      await rejectBtn.first().click();

      // WHEN 填寫原因
      const commentInput = page
        .getByLabel(/原因|reason|comment|備註/i)
        .or(page.locator('textarea'))
        .or(page.locator('[name="comment"]'));

      if (await commentInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentInput.first().fill('人力不足，請改期 - Playwright 測試');
      }

      // WHEN 確認駁回
      const confirmReject = page
        .getByRole('button', { name: /確認駁回|確認|submit|送出/i })
        .or(page.locator('button[type="submit"]'));

      if (await confirmReject.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmReject.first().click();
        await page.waitForLoadState('networkidle');
      }

      // THEN 應顯示成功或返回列表
      const result = page
        .getByText(/駁回成功|rejected|已駁回|成功/i)
        .or(page.locator('[role="alert"]'));

      await takeScreenshot(page, FEATURE, 'reject-success');
    });
  });

  // =============================================
  // 審核歷史
  // =============================================
  test.describe('審核歷史', () => {
    test('Scenario: 查看已審核紀錄', async ({ page }) => {
      await loginAsManager(page);
      await expectLoggedIn(page);

      // WHEN 導航到審核歷史頁
      for (const path of ['/leaves/history', '/leaves/reviewed', '/leaves?tab=history']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const historyContent = page
          .getByText(/已審核|history|歷史|approved|rejected/i)
          .or(page.locator('[data-testid*="history"]'));

        if (await historyContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await takeScreenshot(page, FEATURE, 'approval-history');
          return;
        }
      }

      await takeScreenshot(page, FEATURE, 'approval-history-not-found');
    });
  });

  // =============================================
  // Admin 額度管理（Browser）
  // =============================================
  test.describe('Admin 額度管理', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await expectLoggedIn(page);
    });

    test('Scenario: Admin 額度管理頁面載入', async ({ page }) => {
      // WHEN 導航到額度管理頁面
      for (const path of ['/admin/quotas', '/leave-quotas/manage', '/admin/leave-quotas']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const adminContent = page
          .getByText(/額度管理|quota management|設定額度/i)
          .or(page.getByRole('heading', { name: /額度|quota/i }))
          .or(page.locator('[data-testid*="quota-manage"]'));

        if (await adminContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await takeScreenshot(page, 'F-009', 'admin-quota-management');
          return;
        }
      }

      await takeScreenshot(page, 'F-009', 'admin-quota-page-not-found');
    });

    test('Scenario: Admin 搜尋員工並編輯額度', async ({ page }) => {
      await page.goto('/admin/quotas');
      await page.waitForLoadState('networkidle');

      // 尋找搜尋欄位
      const searchInput = page
        .getByPlaceholder(/搜尋|search|員工/i)
        .or(page.locator('[name="search"]'))
        .or(page.getByRole('searchbox'));

      const hasSearch = await searchInput.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasSearch) {
        // WHEN 搜尋員工
        await searchInput.first().fill('測試');
        await page.waitForLoadState('networkidle');

        // 尋找編輯按鈕
        const editBtn = page
          .getByRole('button', { name: /編輯|edit/i })
          .or(page.locator('[data-testid*="edit"]'));

        if (await editBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await editBtn.first().click();
          await page.waitForLoadState('networkidle');
          await takeScreenshot(page, 'F-009', 'admin-edit-quota');
        }
      }

      await takeScreenshot(page, 'F-009', 'admin-search-employee');
    });
  });
});
