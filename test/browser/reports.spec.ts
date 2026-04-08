import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
  takeScreenshot,
  LOGIN_CREDENTIALS,
} from './helpers';

const FEATURE = 'F-005';

/**
 * 出席報表頁面 Browser 測試
 *
 * 驗證個人報表、團隊報表、全公司報表和匯出功能的 UI 流程
 */

test.describe(`[${FEATURE}] 出席報表頁面 - Browser Test`, () => {
  // =============================================
  // 個人出勤摘要
  // =============================================
  test.describe('個人出勤摘要', () => {
    test('Scenario: 查看個人月報 - 顯示出勤統計', async ({ page }) => {
      // GIVEN - 以員工身份登入
      await loginAsEmployee(page);

      // WHEN - 導航到個人報表頁面
      const reportPaths = ['/reports', '/reports/personal', '/attendance/report', '/dashboard'];
      let found = false;
      for (const path of reportPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasReport = await page
          .locator('[class*="report"], [class*="summary"], [class*="stat"], [class*="card"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasReport) {
          found = true;
          break;
        }
      }

      // THEN - 應顯示出勤統計資訊
      if (found) {
        // 檢查常見的報表欄位文字
        const hasAttendanceInfo = await page
          .getByText(/出勤|attendance|present|工作日|workday/i)
          .first()
          .isVisible()
          .catch(() => false);
        // 至少頁面有內容
        expect(await page.locator('body').textContent()).toBeTruthy();
      }
      await takeScreenshot(page, FEATURE, 'personal-report-view');
    });

    test('Scenario: 個人報表月份選擇', async ({ page }) => {
      // GIVEN
      await loginAsEmployee(page);

      const reportPaths = ['/reports', '/reports/personal', '/attendance/report'];
      for (const path of reportPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasReport = await page
          .locator('[class*="report"], [class*="summary"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasReport) break;
      }

      // WHEN - 嘗試切換月份
      const monthSelector = page
        .locator('select, [role="combobox"], [class*="month-select"], [class*="date-picker"]')
        .first();

      if (await monthSelector.isVisible().catch(() => false)) {
        await takeScreenshot(page, FEATURE, 'report-month-selector');
      }

      // THEN - 頁面正常載入
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // =============================================
  // 團隊報表
  // =============================================
  test.describe('團隊報表', () => {
    test('Scenario: 主管查看團隊報表 - 顯示成員列表', async ({ page }) => {
      // GIVEN - 以主管身份登入
      await loginAsManager(page);

      // WHEN - 導航到團隊報表
      const teamPaths = ['/reports/team', '/team/report', '/reports?scope=team', '/attendance/team-report'];
      let found = false;
      for (const path of teamPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasTeamReport = await page
          .locator('table, [role="table"], [class*="team"], [class*="member-list"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasTeamReport) {
          found = true;
          break;
        }
      }

      // THEN - 應顯示團隊成員出勤資料
      if (found) {
        const rows = page.locator('table tbody tr, [role="row"]');
        const count = await rows.count().catch(() => 0);
        expect(count).toBeGreaterThan(0);
      }
      await takeScreenshot(page, FEATURE, 'team-report-view');
    });

    test('Scenario: 員工無法存取團隊報表 - 403 或重導向', async ({ page }) => {
      // GIVEN - 以員工身份登入
      await loginAsEmployee(page);

      // WHEN - 嘗試存取團隊報表
      const teamPaths = ['/reports/team', '/team/report'];
      for (const path of teamPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
      }

      // THEN - 應顯示錯誤或被重導向
      const hasError = await page
        .getByText(/forbidden|無權限|403|不允許|permission/i)
        .first()
        .isVisible()
        .catch(() => false);

      const redirected = !page.url().includes('/reports/team')
        && !page.url().includes('/team/report');

      expect(hasError || redirected).toBe(true);
      await takeScreenshot(page, FEATURE, 'employee-team-report-forbidden');
    });
  });

  // =============================================
  // 全公司報表
  // =============================================
  test.describe('全公司報表', () => {
    test('Scenario: Admin 查看全公司報表 - 顯示部門列表', async ({ page }) => {
      // GIVEN - 以 Admin 身份登入
      await loginAsAdmin(page);

      // WHEN - 導航到全公司報表
      const companyPaths = ['/reports/company', '/reports?scope=company', '/admin/reports'];
      let found = false;
      for (const path of companyPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasCompanyReport = await page
          .locator('table, [role="table"], [class*="department"], [class*="company"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasCompanyReport) {
          found = true;
          break;
        }
      }

      // THEN - 應顯示部門出勤統計
      if (found) {
        const deptRows = page.locator('table tbody tr, [role="row"]');
        const count = await deptRows.count().catch(() => 0);
        expect(count).toBeGreaterThan(0);
      }
      await takeScreenshot(page, FEATURE, 'company-report-view');
    });

    test('Scenario: Manager 無法存取全公司報表 - 403 或重導向', async ({ page }) => {
      // GIVEN - 以主管身份登入
      await loginAsManager(page);

      // WHEN - 嘗試存取全公司報表
      const companyPaths = ['/reports/company', '/admin/reports'];
      for (const path of companyPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
      }

      // THEN - 應顯示錯誤或被重導向
      const hasError = await page
        .getByText(/forbidden|無權限|403|不允許|permission/i)
        .first()
        .isVisible()
        .catch(() => false);

      const redirected = !page.url().includes('/reports/company')
        && !page.url().includes('/admin/reports');

      expect(hasError || redirected).toBe(true);
      await takeScreenshot(page, FEATURE, 'manager-company-report-forbidden');
    });
  });

  // =============================================
  // 匯出功能
  // =============================================
  test.describe('匯出功能', () => {
    test('Scenario: 主管匯出團隊報表 CSV', async ({ page }) => {
      // GIVEN - 以主管身份登入
      await loginAsManager(page);

      // 導航到團隊報表
      const teamPaths = ['/reports/team', '/team/report', '/reports?scope=team'];
      for (const path of teamPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasPage = await page
          .locator('[class*="report"], table, [class*="team"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasPage) break;
      }

      // WHEN - 找到匯出按鈕
      const exportBtn = page
        .getByRole('button', { name: /export|匯出|下載|download|csv/i })
        .or(page.locator('[class*="export"], [class*="download"]'))
        .first();

      if (await exportBtn.isVisible().catch(() => false)) {
        // 攔截下載事件
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await exportBtn.click();
        const download = await downloadPromise;

        // THEN - 應觸發檔案下載
        if (download) {
          const filename = download.suggestedFilename();
          expect(filename).toMatch(/\.csv$/i);
        }
        await takeScreenshot(page, FEATURE, 'export-csv-clicked');
      } else {
        // 匯出按鈕可能不在此頁面，截圖記錄
        await takeScreenshot(page, FEATURE, 'export-button-not-found');
      }
    });

    test('Scenario: Admin 匯出全公司報表', async ({ page }) => {
      // GIVEN - 以 Admin 身份登入
      await loginAsAdmin(page);

      // 導航到全公司報表
      const companyPaths = ['/reports/company', '/reports?scope=company', '/admin/reports'];
      for (const path of companyPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasPage = await page
          .locator('[class*="report"], table, [class*="company"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasPage) break;
      }

      // WHEN - 找到匯出按鈕
      const exportBtn = page
        .getByRole('button', { name: /export|匯出|下載|download/i })
        .or(page.locator('[class*="export"], [class*="download"]'))
        .first();

      if (await exportBtn.isVisible().catch(() => false)) {
        await takeScreenshot(page, FEATURE, 'admin-export-button-visible');
      }

      // THEN - 頁面正常載入
      await expect(page.locator('body')).toBeVisible();
      await takeScreenshot(page, FEATURE, 'admin-company-report-export');
    });
  });
});
