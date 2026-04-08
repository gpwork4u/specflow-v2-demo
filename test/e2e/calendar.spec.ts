import { test, expect } from '@playwright/test';
import {
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
  authHeaders,
} from '../helpers/api-client';
import { API } from '../helpers/test-data';

const FEATURE = 'F-004';

test.describe(`[${FEATURE}] 行事曆 - API E2E`, () => {
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;
  let managerDeptId: string;

  test.beforeAll(async ({ request }) => {
    const empLogin = await loginAsEmployee(request);
    employeeToken = empLogin.access_token;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;
    managerDeptId = mgrLogin.user.department.id;

    const admLogin = await loginAsAdmin(request);
    adminToken = admLogin.access_token;
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 查看個人月行事曆 - 200 + 30 天資料 + clock/leaves', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.month).toBe(4);
      expect(body.days).toHaveLength(30); // 四月有 30 天
      // 每天應有完整結構
      for (const day of body.days) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('is_workday');
        expect(day).toHaveProperty('clock');
        expect(day).toHaveProperty('leaves');
        expect(Array.isArray(day.leaves)).toBe(true);
      }
    });

    test('Scenario: 主管查看團隊行事曆 - 200 + members + days', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.TEAM}?year=2026&month=4`,
        { headers: authHeaders(managerToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.month).toBe(4);
      expect(body).toHaveProperty('department');
      expect(body.department).toHaveProperty('id');
      expect(body.department).toHaveProperty('name');
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members.length).toBeGreaterThan(0);
      // 每個成員應有 user + days
      for (const member of body.members) {
        expect(member).toHaveProperty('user');
        expect(member.user).toHaveProperty('id');
        expect(member.user).toHaveProperty('name');
        expect(Array.isArray(member.days)).toBe(true);
        expect(member.days).toHaveLength(30);
        for (const day of member.days) {
          expect(day).toHaveProperty('date');
          expect(day).toHaveProperty('status');
          expect([
            'present', 'late', 'early_leave', 'leave', 'absent', 'holiday', 'overtime',
          ]).toContain(day.status);
        }
      }
    });

    test('Scenario: Admin 查看指定部門行事曆 - 200', async ({ request }) => {
      test.skip(!managerDeptId, '無可用部門 ID');

      // WHEN
      const res = await request.get(
        `${API.CALENDAR.TEAM}?year=2026&month=4&department_id=${managerDeptId}`,
        { headers: authHeaders(adminToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.department.id).toBe(managerDeptId);
      expect(Array.isArray(body.members)).toBe(true);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 員工嘗試看團隊行事曆 - 403 FORBIDDEN', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.TEAM}?year=2026&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: 無效月份 - 400 INVALID_INPUT', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=13`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: 未認證存取 - 401 UNAUTHORIZED', async ({ request }) => {
      // WHEN - 不帶 token
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=4`,
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
    test('Scenario: 查看未來月份（無資料）- 200 + 全 null', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=12`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.month).toBe(12);
      expect(body.days).toHaveLength(31); // 十二月有 31 天
      for (const day of body.days) {
        expect(day.clock).toBeNull();
        expect(day.leaves).toEqual([]);
        expect(day.overtime).toBeNull();
      }
    });

    test('Scenario: 同一天既有半天假又有打卡 - leaves + clock 都有值', async ({ request }) => {
      // WHEN - 查詢 2026 年 4 月（假設測試資料中 4/10 有半天假+打卡）
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      // 找到同時有 clock 和 leaves 的日期
      const daysWithBoth = body.days.filter(
        (d: any) => d.clock !== null && d.leaves.length > 0,
      );
      // 如果有這樣的資料，驗證結構
      if (daysWithBoth.length > 0) {
        const day = daysWithBoth[0];
        expect(day.clock).toHaveProperty('clock_in');
        expect(day.leaves[0]).toHaveProperty('leave_type');
        expect(day.leaves[0]).toHaveProperty('start_half');
      }
      // 即使目前沒有資料，API 應該正常回傳（不 crash）
      expect(body.days.length).toBe(30);
    });

    test('Scenario: 無效年份 - 400', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=1999&month=4`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: month=0 - 400', async ({ request }) => {
      // WHEN
      const res = await request.get(
        `${API.CALENDAR.PERSONAL}?year=2026&month=0`,
        { headers: authHeaders(employeeToken) },
      );

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });
  });
});
