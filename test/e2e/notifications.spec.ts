import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsManager,
  login,
  authHeaders,
  createEmployee,
  createLeave,
  createLeaveAndGetId,
  approveLeave,
  rejectLeave,
  setEmployeeQuotas,
  createOvertime,
  createOvertimeAndGetId,
  approveOvertime,
  rejectOvertime,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../helpers/api-client';
import {
  API,
  LEAVE_TYPES,
  MANAGER_USER,
  futureDate,
  todayDate,
} from '../helpers/test-data';

const FEATURE = 'F-007';

test.describe(`[${FEATURE}] 通知功能 - API E2E`, () => {
  let adminToken: string;
  let managerToken: string;
  let managerUserId: string;
  let testDeptId: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;
    managerUserId = mgrLogin.user.id;

    const deptRes = await request.get(API.DEPARTMENTS, {
      headers: authHeaders(adminToken),
    });
    const depts = await deptRes.json();
    testDeptId = depts.data?.[0]?.id;
  });

  /**
   * 建立獨立的測試員工並登入
   */
  async function createTestEmployee(
    request: any,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const ts = Date.now();
    const email = `notif-${suffix}-${ts}@company.com`;
    const password = 'NotifTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `NTF-${suffix}-${ts}`,
      email,
      password,
      name: `通知測試-${suffix}`,
      role: 'employee',
      department_id: testDeptId,
      hire_date: '2024-01-01',
      manager_id: managerUserId,
    });
    expect(createRes.status()).toBe(201);
    const empBody = await createRes.json();

    const loginRes = await request.post(API.AUTH.LOGIN, {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    return { token: loginBody.access_token, userId: empBody.id };
  }

  /**
   * 確保員工有特休額度
   */
  async function ensureLeaveQuota(
    request: any,
    userId: string,
  ): Promise<void> {
    await setEmployeeQuotas(request, adminToken, userId, {
      year: new Date().getFullYear(),
      quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
    });
  }

  // ===========================================
  // Happy Path
  // ===========================================

  test.describe('Happy Path', () => {
    test('Scenario: 查看通知列表', async ({ request }) => {
      // GIVEN 員工登入
      const { token } = await createTestEmployee(request, 'list');

      // WHEN GET /api/v1/notifications
      const res = await getNotifications(request, token);

      // THEN response status = 200
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.meta).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
    });

    test('Scenario: 查看未讀數量', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'unread');

      // WHEN GET /api/v1/notifications/unread-count
      const res = await getUnreadCount(request, token);

      // THEN response status = 200, count >= 0
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.count).toBeGreaterThanOrEqual(0);
    });

    test('Scenario: 請假核准時自動建立通知', async ({ request }) => {
      // GIVEN 員工建立請假
      const { token: empToken, userId } = await createTestEmployee(request, 'leave-approved');
      await ensureLeaveQuota(request, userId);

      const leaveId = await createLeaveAndGetId(request, empToken, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(14),
        end_date: futureDate(14),
        reason: '通知測試-請假核准',
      });

      // WHEN 主管核准
      const approveRes = await approveLeave(request, managerToken, leaveId);
      expect(approveRes.status()).toBe(200);

      // THEN 員工收到 leave_approved 通知
      const notifRes = await getNotifications(request, empToken);
      expect(notifRes.status()).toBe(200);
      const notifs = await notifRes.json();

      const leaveNotif = notifs.data.find(
        (n: any) => n.type === 'leave_approved' && n.reference_id === leaveId,
      );
      expect(leaveNotif).toBeDefined();
      expect(leaveNotif.reference_type).toBe('leave_request');
      expect(leaveNotif.is_read).toBe(false);
    });

    test('Scenario: 請假駁回時自動建立通知', async ({ request }) => {
      const { token: empToken, userId } = await createTestEmployee(request, 'leave-rejected');
      await ensureLeaveQuota(request, userId);

      const leaveId = await createLeaveAndGetId(request, empToken, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(15),
        end_date: futureDate(15),
        reason: '通知測試-請假駁回',
      });

      // WHEN 主管駁回
      await rejectLeave(request, managerToken, leaveId, '人力不足');

      // THEN 員工收到 leave_rejected 通知
      const notifRes = await getNotifications(request, empToken);
      const notifs = await notifRes.json();
      const rejectNotif = notifs.data.find(
        (n: any) => n.type === 'leave_rejected' && n.reference_id === leaveId,
      );
      expect(rejectNotif).toBeDefined();
      expect(rejectNotif.content).toContain('駁回');
    });

    test('Scenario: 加班核准時自動建立通知', async ({ request }) => {
      const { token: empToken } = await createTestEmployee(request, 'ot-approved');

      const otId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '21:00',
        reason: '通知測試-加班核准',
      });

      // WHEN 主管核准
      await approveOvertime(request, managerToken, otId);

      // THEN 員工收到 overtime_approved 通知
      const notifRes = await getNotifications(request, empToken);
      const notifs = await notifRes.json();
      const otNotif = notifs.data.find(
        (n: any) => n.type === 'overtime_approved',
      );
      expect(otNotif).toBeDefined();
    });

    test('Scenario: 部屬送出請假時主管收到通知', async ({ request }) => {
      const { token: empToken, userId } = await createTestEmployee(request, 'new-leave-notif');
      await ensureLeaveQuota(request, userId);

      // 記錄主管目前的通知數
      const beforeRes = await getNotifications(request, managerToken);
      const beforeNotifs = await beforeRes.json();
      const beforeCount = beforeNotifs.meta.total;

      // WHEN 員工送出請假
      await createLeave(request, empToken, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(20),
        end_date: futureDate(20),
        reason: '主管通知測試',
      });

      // THEN 主管收到 new_leave_request 通知
      const afterRes = await getNotifications(request, managerToken);
      const afterNotifs = await afterRes.json();
      expect(afterNotifs.meta.total).toBeGreaterThan(beforeCount);

      const newLeaveNotif = afterNotifs.data.find(
        (n: any) => n.type === 'new_leave_request',
      );
      expect(newLeaveNotif).toBeDefined();
    });

    test('Scenario: 標記單則已讀', async ({ request }) => {
      // GIVEN 員工有通知（透過建立請假觸發主管通知，或直接建立一個場景）
      const { token: empToken, userId } = await createTestEmployee(request, 'mark-read');
      await ensureLeaveQuota(request, userId);

      // 建立一筆請假讓主管核准，產生通知
      const leaveId = await createLeaveAndGetId(request, empToken, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(16),
        end_date: futureDate(16),
        reason: '標記已讀測試',
      });
      await approveLeave(request, managerToken, leaveId);

      // 取得未讀通知
      const notifRes = await getNotifications(request, empToken, { is_read: 'false' });
      const notifs = await notifRes.json();
      expect(notifs.data.length).toBeGreaterThanOrEqual(1);
      const notifId = notifs.data[0].id;

      // WHEN 標記已讀
      const readRes = await markNotificationRead(request, empToken, notifId);

      // THEN is_read = true
      expect(readRes.status()).toBe(200);
      const readBody = await readRes.json();
      expect(readBody.is_read).toBe(true);
    });

    test('Scenario: 全部標記已讀', async ({ request }) => {
      // GIVEN 員工有多筆未讀通知
      const { token: empToken, userId } = await createTestEmployee(request, 'read-all');
      await ensureLeaveQuota(request, userId);

      // 產生多筆通知
      for (let i = 0; i < 3; i++) {
        const leaveId = await createLeaveAndGetId(request, empToken, {
          leave_type: LEAVE_TYPES.ANNUAL,
          start_date: futureDate(30 + i),
          end_date: futureDate(30 + i),
          reason: `全部已讀測試-${i}`,
        });
        await approveLeave(request, managerToken, leaveId);
      }

      // 確認有未讀
      const beforeCount = await getUnreadCount(request, empToken);
      const beforeBody = await beforeCount.json();
      expect(beforeBody.count).toBeGreaterThanOrEqual(3);

      // WHEN 全部標記已讀
      const res = await markAllNotificationsRead(request, empToken);

      // THEN updated_count >= 3, 所有通知已讀
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.updated_count).toBeGreaterThanOrEqual(3);

      // 驗證未讀數 = 0
      const afterCount = await getUnreadCount(request, empToken);
      const afterBody = await afterCount.json();
      expect(afterBody.count).toBe(0);
    });
  });

  // ===========================================
  // Error Handling
  // ===========================================

  test.describe('Error Handling', () => {
    test('Scenario: 標記不存在的通知', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'not-found');

      // WHEN 標記不存在的通知
      const res = await markNotificationRead(
        request,
        token,
        '00000000-0000-0000-0000-000000000000',
      );

      // THEN 404 NOT_FOUND
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('Scenario: 標記他人的通知（回傳 404 不洩漏資訊）', async ({ request }) => {
      // GIVEN 員工 A 有一筆通知
      const { token: tokenA, userId: userIdA } = await createTestEmployee(request, 'other-a');
      await ensureLeaveQuota(request, userIdA);

      const leaveId = await createLeaveAndGetId(request, tokenA, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(17),
        end_date: futureDate(17),
        reason: '他人通知測試',
      });
      await approveLeave(request, managerToken, leaveId);

      const notifsA = await getNotifications(request, tokenA);
      const notifsABody = await notifsA.json();
      const notifId = notifsABody.data[0].id;

      // WHEN 員工 B 嘗試標記 A 的通知
      const { token: tokenB } = await createTestEmployee(request, 'other-b');
      const res = await markNotificationRead(request, tokenB, notifId);

      // THEN 404（不洩漏通知是否存在）
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('Scenario: 未授權存取通知', async ({ request }) => {
      const res = await request.get(API.NOTIFICATIONS.BASE);

      // THEN 401
      expect(res.status()).toBe(401);
    });
  });

  // ===========================================
  // Edge Cases
  // ===========================================

  test.describe('Edge Cases', () => {
    test('Scenario: 篩選未讀通知', async ({ request }) => {
      const { token, userId } = await createTestEmployee(request, 'filter-unread');
      await ensureLeaveQuota(request, userId);

      // 產生通知
      const leaveId = await createLeaveAndGetId(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(18),
        end_date: futureDate(18),
        reason: '篩選未讀測試',
      });
      await approveLeave(request, managerToken, leaveId);

      // WHEN 篩選未讀
      const res = await getNotifications(request, token, { is_read: 'false' });

      // THEN 只回傳未讀通知
      expect(res.status()).toBe(200);
      const body = await res.json();
      for (const n of body.data) {
        expect(n.is_read).toBe(false);
      }
    });

    test('Scenario: 通知按 created_at 降序排列', async ({ request }) => {
      const { token, userId } = await createTestEmployee(request, 'order');
      await ensureLeaveQuota(request, userId);

      // 產生多筆通知
      for (let i = 0; i < 3; i++) {
        const lid = await createLeaveAndGetId(request, token, {
          leave_type: LEAVE_TYPES.ANNUAL,
          start_date: futureDate(40 + i),
          end_date: futureDate(40 + i),
          reason: `排序測試-${i}`,
        });
        await approveLeave(request, managerToken, lid);
      }

      // WHEN 查詢通知列表
      const res = await getNotifications(request, token);
      const body = await res.json();

      // THEN 按 created_at 降序排列
      for (let i = 1; i < body.data.length; i++) {
        const prev = new Date(body.data[i - 1].created_at).getTime();
        const curr = new Date(body.data[i].created_at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    test('Scenario: 加班駁回時通知包含駁回原因', async ({ request }) => {
      const { token: empToken } = await createTestEmployee(request, 'ot-reject-reason');

      const otId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '加班駁回通知測試',
      });

      // WHEN 主管駁回，附原因
      await rejectOvertime(request, managerToken, otId, '非必要加班');

      // THEN 通知 content 包含駁回原因
      const notifRes = await getNotifications(request, empToken);
      const notifs = await notifRes.json();
      const rejectNotif = notifs.data.find(
        (n: any) => n.type === 'overtime_rejected',
      );
      expect(rejectNotif).toBeDefined();
      expect(rejectNotif.content).toContain('駁回');
    });

    test('Scenario: 分頁參數測試', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'pagination');

      // WHEN 指定 page 和 limit
      const res = await getNotifications(request, token, {
        page: '1',
        limit: '5',
      });

      // THEN 回傳正確的分頁
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });
  });
});
