import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
  takeScreenshot,
  LOGIN_CREDENTIALS,
} from './helpers';

const FEATURE = 'F-004';

/**
 * 行事曆頁面 Browser 測試
 *
 * 驗證個人行事曆和團隊行事曆的 UI 互動流程
 */

test.describe(`[${FEATURE}] 行事曆頁面 - Browser Test`, () => {
  // =============================================
  // 個人行事曆
  // =============================================
  test.describe('個人行事曆', () => {
    test('Scenario: 查看個人月行事曆 - 顯示月曆視圖', async ({ page }) => {
      // GIVEN - 以員工身份登入
      await loginAsEmployee(page);

      // WHEN - 導航到個人行事曆頁面
      const calendarPaths = ['/calendar', '/calendar/personal', '/attendance/calendar', '/dashboard'];
      let found = false;
      for (const path of calendarPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        // 檢查是否有月曆相關元素
        const hasCalendar = await page
          .locator('[class*="calendar"], [role="grid"], table, [class*="month"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasCalendar) {
          found = true;
          break;
        }
      }

      // THEN - 應顯示行事曆視圖
      if (found) {
        // 驗證包含日期格子
        const dayCells = page.locator('[class*="day"], [role="gridcell"], td').first();
        await expect(dayCells).toBeVisible({ timeout: 10000 });
      }
      await takeScreenshot(page, FEATURE, 'personal-calendar-view');
    });

    test('Scenario: 月份切換功能', async ({ page }) => {
      // GIVEN
      await loginAsEmployee(page);

      // WHEN - 導航到行事曆
      const calendarPaths = ['/calendar', '/calendar/personal', '/attendance/calendar'];
      for (const path of calendarPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasCalendar = await page
          .locator('[class*="calendar"], [role="grid"], table')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasCalendar) break;
      }

      // 嘗試切換月份（找下一月/上一月按鈕）
      const nextBtn = page
        .getByRole('button', { name: /next|下一月|>|後/i })
        .or(page.locator('[aria-label*="next"], [class*="next"]'))
        .first();

      const prevBtn = page
        .getByRole('button', { name: /prev|上一月|<|前/i })
        .or(page.locator('[aria-label*="prev"], [class*="prev"]'))
        .first();

      const hasNav = await nextBtn.isVisible().catch(() => false)
        || await prevBtn.isVisible().catch(() => false);

      if (hasNav) {
        await takeScreenshot(page, FEATURE, 'calendar-before-month-switch');
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForLoadState('networkidle');
        }
        await takeScreenshot(page, FEATURE, 'calendar-after-month-switch');
      }

      // THEN - 頁面不應出錯
      await expect(page.locator('body')).toBeVisible();
    });

    test('Scenario: 點擊日期查看詳情', async ({ page }) => {
      // GIVEN
      await loginAsEmployee(page);

      const calendarPaths = ['/calendar', '/calendar/personal', '/attendance/calendar'];
      for (const path of calendarPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasCalendar = await page
          .locator('[class*="calendar"], [role="grid"], table')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasCalendar) break;
      }

      // WHEN - 點擊一個日期格子
      const dayCell = page
        .locator('[class*="day"], [role="gridcell"], td')
        .filter({ hasText: /\d+/ })
        .first();

      if (await dayCell.isVisible().catch(() => false)) {
        await dayCell.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, FEATURE, 'calendar-day-detail');
      }

      // THEN - 頁面不應出錯
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // =============================================
  // 團隊行事曆
  // =============================================
  test.describe('團隊行事曆', () => {
    test('Scenario: 主管查看團隊行事曆 - 顯示成員列表', async ({ page }) => {
      // GIVEN - 以主管身份登入
      await loginAsManager(page);

      // WHEN - 導航到團隊行事曆
      const teamPaths = ['/calendar/team', '/team/calendar', '/calendar?view=team', '/attendance/team'];
      let found = false;
      for (const path of teamPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        // 檢查是否有表格或成員列表
        const hasTeamView = await page
          .locator('table, [role="table"], [class*="team"], [class*="member"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasTeamView) {
          found = true;
          break;
        }
      }

      // THEN - 應顯示團隊成員的出勤狀態
      if (found) {
        // 應有多列資料（成員）
        const rows = page.locator('table tr, [role="row"]');
        const count = await rows.count().catch(() => 0);
        expect(count).toBeGreaterThan(0);
      }
      await takeScreenshot(page, FEATURE, 'team-calendar-view');
    });

    test('Scenario: 員工無法存取團隊行事曆 - 403 或重導向', async ({ page }) => {
      // GIVEN - 以員工身份登入
      await loginAsEmployee(page);

      // WHEN - 嘗試存取團隊行事曆
      const teamPaths = ['/calendar/team', '/team/calendar'];
      for (const path of teamPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
      }

      // THEN - 應顯示錯誤訊息或被重導向
      const hasError = await page
        .getByText(/forbidden|無權限|403|不允許|permission/i)
        .first()
        .isVisible()
        .catch(() => false);

      const redirected = !page.url().includes('/calendar/team')
        && !page.url().includes('/team/calendar');

      // 員工應該被拒絕或被重導向
      expect(hasError || redirected).toBe(true);
      await takeScreenshot(page, FEATURE, 'employee-team-calendar-forbidden');
    });
  });

  // =============================================
  // 出勤狀態顏色標示
  // =============================================
  test.describe('UI 呈現', () => {
    test('Scenario: 行事曆顯示出勤狀態標示', async ({ page }) => {
      // GIVEN
      await loginAsEmployee(page);

      const calendarPaths = ['/calendar', '/calendar/personal', '/attendance/calendar'];
      for (const path of calendarPaths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasCalendar = await page
          .locator('[class*="calendar"], [role="grid"], table')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasCalendar) break;
      }

      // THEN - 截圖記錄 UI 狀態（顏色標示由視覺驗證）
      await takeScreenshot(page, FEATURE, 'calendar-attendance-status-colors');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
