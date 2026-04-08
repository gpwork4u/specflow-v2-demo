import { test, expect } from '@playwright/test';
import {
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
  authHeaders,
} from '../helpers/api-client';
import { API } from '../helpers/test-data';

const FEATURE = 'F-005';

test.describe(`[${FEATURE}] 出席報表 - API E2E`, () => {
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    const empLogin = await loginAsEmployee(request);
    employeeToken = empLogin.access_token;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;

    const admLogin = await loginAsAdmin(request);
    adminToken = admLogin.access_token;
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 查看個人月報 - 200 + summary + leave_summary', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.PERSONAL}?year=2026&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('name');
      expect(body.year).toBe(2026);
      expect(body.month).toBe(4);

      // summary 結構驗證
      expect(body).toHaveProperty('summary');
      const s = body.summary;
      expect(s).toHaveProperty('workdays');
      expect(s).toHaveProperty('present_days');
      expect(s).toHaveProperty('absent_days');
      expect(s).toHaveProperty('late_days');
      expect(s).toHaveProperty('early_leave_days');
      expect(s).toHaveProperty('leave_days');
      expect(s).toHaveProperty('overtime_hours');
      expect(s).toHaveProperty('attendance_rate');
      expect(typeof s.attendance_rate).toBe('number');

      // leave_summary 結構驗證
      expect(Array.isArray(body.leave_summary)).toBe(true);
      for (const item of body.leave_summary) {
        expect(item).toHaveProperty('leave_type');
        expect(item).toHaveProperty('hours');
        expect(typeof item.hours).toBe('number');
      }
    });

    test('Scenario: 主管查看團隊報表 - 200 + members + team_summary', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.TEAM}?year=2026&month=4`,
        { headers: authHeaders(managerToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('department');
      expect(body.department).toHaveProperty('id');
      expect(body.department).toHaveProperty('name');
      expect(body.year).toBe(2026);
      expect(body.month).toBe(4);

      // team_summary
      expect(body).toHaveProperty('team_summary');
      const ts = body.team_summary;
      expect(ts).toHaveProperty('total_members');
      expect(ts).toHaveProperty('avg_attendance_rate');
      expect(ts).toHaveProperty('total_late_count');
      expect(ts).toHaveProperty('total_leave_days');

      // members
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members.length).toBeGreaterThan(0);
      for (const m of body.members) {
        expect(m).toHaveProperty('user');
        expect(m).toHaveProperty('present_days');
        expect(m).toHaveProperty('absent_days');
        expect(m).toHaveProperty('late_days');
        expect(m).toHaveProperty('attendance_rate');
      }
    });

    test('Scenario: Admin 查看全公司報表 - 200 + departments + company_summary', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.COMPANY}?year=2026&month=4`,
        { headers: authHeaders(adminToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.month).toBe(4);

      // company_summary
      expect(body).toHaveProperty('company_summary');
      const cs = body.company_summary;
      expect(cs).toHaveProperty('total_employees');
      expect(cs).toHaveProperty('avg_attendance_rate');
      expect(cs).toHaveProperty('total_late_count');
      expect(cs).toHaveProperty('total_leave_days');
      expect(cs).toHaveProperty('total_overtime_hours');

      // departments
      expect(Array.isArray(body.departments)).toBe(true);
      expect(body.departments.length).toBeGreaterThan(0);
      for (const dept of body.departments) {
        expect(dept).toHaveProperty('department');
        expect(dept.department).toHaveProperty('id');
        expect(dept.department).toHaveProperty('name');
        expect(dept).toHaveProperty('total_members');
        expect(dept).toHaveProperty('avg_attendance_rate');
      }
    });

    test('Scenario: 匯出團隊報表 CSV - 200 + text/csv', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.EXPORT}?year=2026&month=4&scope=team&format=csv`,
        { headers: authHeaders(managerToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const contentType = res.headers()['content-type'] || '';
      expect(contentType).toContain('text/csv');
      const text = await res.text();
      expect(text.length).toBeGreaterThan(0);
      // CSV 應包含標題列
      expect(text).toContain(',');
    });

    test('Scenario: Admin 匯出全公司報表 CSV', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.EXPORT}?year=2026&month=4&scope=company&format=csv`,
        { headers: authHeaders(adminToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const contentType = res.headers()['content-type'] || '';
      expect(contentType).toContain('text/csv');
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 員工嘗試看團隊報表 - 403 FORBIDDEN', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.TEAM}?year=2026&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: Manager 嘗試看全公司報表 - 403 FORBIDDEN', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.COMPANY}?year=2026&month=4`,
        { headers: authHeaders(managerToken) },
      );

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: 員工嘗試匯出報表 - 403', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.EXPORT}?year=2026&month=4&scope=team&format=csv`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: 未認證存取個人報表 - 401', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.PERSONAL}?year=2026&month=4`,
      );

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 查看未來月份 - 200 + 數值 0', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.PERSONAL}?year=2026&month=12`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.month).toBe(12);
      const s = body.summary;
      expect(s.present_days).toBe(0);
      expect(s.absent_days).toBe(0);
      expect(s.late_days).toBe(0);
      expect(s.early_leave_days).toBe(0);
      expect(s.leave_days).toBe(0);
      expect(s.overtime_hours).toBe(0);
    });

    test('Scenario: 團隊報表未來月份 - 200 + 數值 0', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.TEAM}?year=2026&month=12`,
        { headers: authHeaders(managerToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      const ts = body.team_summary;
      expect(ts.total_late_count).toBe(0);
      expect(ts.total_leave_days).toBe(0);
    });

    test('Scenario: 缺少必要參數 year - 400', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.PERSONAL}?month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(400);
    });

    test('Scenario: 缺少必要參數 month - 400', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.REPORTS.PERSONAL}?year=2026`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(400);
    });
  });
});
