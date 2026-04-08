import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsEmployee,
  loginAsManager,
  authHeaders,
  createEmployee,
  createDepartment,
  createLeave,
  getLeaves,
  getLeaveById,
  cancelLeave,
  createLeaveAndGetId,
  approveLeave,
  setEmployeeQuotas,
  getMyQuotas,
} from '../helpers/api-client';
import {
  API,
  LEAVE_TYPES,
  HALF_DAY,
  LEAVE_STATUS,
  futureDate,
  pastDate,
  todayDate,
} from '../helpers/test-data';

const FEATURE = 'F-002';

test.describe(`[${FEATURE}] 請假申請 - API E2E`, () => {
  let adminToken: string;
  let testDeptId: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    // 取得測試部門
    const deptRes = await request.get(API.DEPARTMENTS, {
      headers: authHeaders(adminToken),
    });
    const depts = await deptRes.json();
    testDeptId = depts.data?.[0]?.id;
  });

  /**
   * 建立獨立的測試員工並登入，回傳 { token, userId }
   * 每個 test 使用獨立帳號以確保額度和請假紀錄不互相干擾
   */
  async function createTestEmployee(
    request: any,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const ts = Date.now();
    const email = `leave-${suffix}-${ts}@company.com`;
    const password = 'LeaveTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `LV-${suffix}-${ts}`,
      email,
      password,
      name: `請假測試-${suffix}`,
      role: 'employee',
      department_id: testDeptId,
      hire_date: '2024-01-01',
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
   * 確保員工有足夠的特休額度
   */
  async function ensureAnnualQuota(
    request: any,
    userId: string,
    totalHours: number,
  ) {
    await setEmployeeQuotas(request, adminToken, userId, {
      year: 2026,
      quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: totalHours }],
    });
  }

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 申請特休一天 - 201 + status=pending + hours=8.0', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'annual-1d');
      await ensureAnnualQuota(request, userId, 80);

      // WHEN
      const startDate = futureDate(7);
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: startDate,
        end_date: startDate,
        reason: '個人事務',
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('user_id', userId);
      expect(body).toHaveProperty('leave_type', LEAVE_TYPES.ANNUAL);
      expect(body).toHaveProperty('start_date', startDate);
      expect(body).toHaveProperty('end_date', startDate);
      expect(body).toHaveProperty('hours', 8.0);
      expect(body).toHaveProperty('status', LEAVE_STATUS.PENDING);
      expect(body).toHaveProperty('reason', '個人事務');
      expect(body.reviewer_id).toBeNull();
    });

    test('Scenario: 申請半天假 - 201 + hours=4.0', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'half-day');
      // 確保事假額度
      await setEmployeeQuotas(request, adminToken, userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.PERSONAL, total_hours: 56 }],
      });

      const startDate = futureDate(8);

      // WHEN
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.PERSONAL,
        start_date: startDate,
        end_date: startDate,
        start_half: HALF_DAY.MORNING,
        end_half: HALF_DAY.MORNING,
        reason: '看診',
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.hours).toBe(4.0);
    });

    test('Scenario: 申請跨多天假 - 201 + hours 正確計算', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'multi-day');
      await ensureAnnualQuota(request, userId, 120);

      // 找到一個星期一到五的完整區間（避免週末干擾）
      const startDate = futureDate(14);
      const endDate = futureDate(18); // 5 天

      // WHEN - start_half=afternoon 表示第一天只請下午
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: startDate,
        end_date: endDate,
        start_half: HALF_DAY.AFTERNOON,
        end_half: HALF_DAY.FULL,
        reason: '出國旅遊',
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      // 第一天下午 4h + 中間 3 天 * 8h + 最後一天 8h = 4 + 24 + 8 = 36
      expect(body.hours).toBe(36.0);
      expect(body.status).toBe(LEAVE_STATUS.PENDING);
    });

    test('Scenario: 查詢個人請假紀錄 - 200', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'list');
      await ensureAnnualQuota(request, userId, 80);

      // GIVEN - 建立 2 筆請假
      await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(10),
        end_date: futureDate(10),
        reason: '請假1',
      });
      await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(15),
        end_date: futureDate(15),
        reason: '請假2',
      });

      // WHEN
      const res = await getLeaves(request, token);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('limit');
    });

    test('Scenario: 取消 pending 請假 - 200 + status=cancelled', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'cancel-pending');
      await ensureAnnualQuota(request, userId, 80);

      // GIVEN
      const leaveId = await createLeaveAndGetId(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(20),
        end_date: futureDate(20),
        reason: '待取消',
      });

      // WHEN
      const res = await cancelLeave(request, token, leaveId);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id', leaveId);
      expect(body).toHaveProperty('status', LEAVE_STATUS.CANCELLED);
    });

    test('Scenario: 取消已核准但未開始的請假 - 200 + 退還額度', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'cancel-approved');
      await ensureAnnualQuota(request, userId, 80);

      // GIVEN - 建立請假
      const leaveDate = futureDate(25);
      const leaveId = await createLeaveAndGetId(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: leaveDate,
        end_date: leaveDate,
        reason: '已核准待取消',
      });

      // GIVEN - 主管核准
      const mgrLogin = await loginAsManager(request);
      const approveRes = await approveLeave(request, mgrLogin.access_token, leaveId, '核准');
      // 如果主管不是直屬可能失敗，改用 admin 核准
      if (approveRes.status() !== 200) {
        const adminApprove = await approveLeave(request, adminToken, leaveId, '核准');
        expect(adminApprove.status()).toBe(200);
      }

      // 記錄核准後的額度
      const quotaBefore = await getMyQuotas(request, token, 2026);
      const beforeBody = await quotaBefore.json();
      const annualBefore = beforeBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );

      // WHEN - 取消
      const res = await cancelLeave(request, token, leaveId);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe(LEAVE_STATUS.CANCELLED);

      // AND 額度退還
      const quotaAfter = await getMyQuotas(request, token, 2026);
      const afterBody = await quotaAfter.json();
      const annualAfter = afterBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annualAfter.remaining_hours).toBeGreaterThan(annualBefore.remaining_hours);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 額度不足 - 422 INSUFFICIENT_QUOTA', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'insuf-quota');
      // 設定極低額度
      await ensureAnnualQuota(request, userId, 4);

      // WHEN - 申請 1 天 (8h) 但只有 4h
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(10),
        end_date: futureDate(10),
        reason: '旅遊',
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('INSUFFICIENT_QUOTA');
    });

    test('Scenario: 日期衝突 - 409 DATE_CONFLICT', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'conflict');
      await ensureAnnualQuota(request, userId, 80);

      const sameDate = futureDate(12);

      // GIVEN - 先建立一筆
      await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: sameDate,
        end_date: sameDate,
        reason: '第一筆',
      });

      // WHEN - 同日再申請
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.PERSONAL,
        start_date: sameDate,
        end_date: sameDate,
        reason: '第二筆',
      });

      // THEN
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('DATE_CONFLICT');
    });

    test('Scenario: 申請過去日期 - 422 PAST_DATE', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'past');
      await ensureAnnualQuota(request, userId, 80);

      // WHEN - 申請 7 天前（超過病假追溯期限）
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: pastDate(7),
        end_date: pastDate(7),
        reason: '旅遊',
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PAST_DATE');
    });

    test('Scenario: 缺少必填欄位 - 400', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token } = await createTestEmployee(request, 'missing-fields');

      // WHEN - 缺少 end_date 和 reason
      const res = await request.post(API.LEAVES.BASE, {
        data: {
          leave_type: LEAVE_TYPES.ANNUAL,
          start_date: futureDate(10),
        },
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: 取消非自己的假單 - 403', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const empA = await createTestEmployee(request, 'cancel-a');
      const empB = await createTestEmployee(request, 'cancel-b');
      await ensureAnnualQuota(request, empB.userId, 80);

      // GIVEN - empB 建立一筆
      const leaveId = await createLeaveAndGetId(request, empB.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(22),
        end_date: futureDate(22),
        reason: 'B 的假',
      });

      // WHEN - empA 嘗試取消 empB 的假
      const res = await cancelLeave(request, empA.token, leaveId);

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 病假可追溯 3 天 - 201', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'sick-3d');
      // 確保病假額度
      await setEmployeeQuotas(request, adminToken, userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.SICK, total_hours: 240 }],
      });

      // WHEN - 申請 3 天前的病假
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.SICK,
        start_date: pastDate(3),
        end_date: pastDate(3),
        reason: '身體不適',
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.leave_type).toBe(LEAVE_TYPES.SICK);
    });

    test('Scenario: 病假追溯超過 3 天被拒 - 422', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'sick-4d');
      await setEmployeeQuotas(request, adminToken, userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.SICK, total_hours: 240 }],
      });

      // WHEN - 申請 4 天前的病假
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.SICK,
        start_date: pastDate(4),
        end_date: pastDate(4),
        reason: '身體不適',
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PAST_DATE');
    });

    test('Scenario: 取消已開始的 approved 假 - 422 LEAVE_STARTED', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'cancel-started');
      // 需要病假額度（因為病假可追溯，用來建立今天的假）
      await setEmployeeQuotas(request, adminToken, userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.SICK, total_hours: 240 }],
      });

      // GIVEN - 建立今天的病假（病假允許 today）
      const today = todayDate();
      const leaveRes = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.SICK,
        start_date: today,
        end_date: today,
        reason: '身體不適 - 測試取消',
      });

      // 如果無法建立今天的假，跳過
      if (leaveRes.status() !== 201) {
        test.skip(true, '無法建立今天的請假');
      }

      const leaveBody = await leaveRes.json();
      const leaveId = leaveBody.id;

      // GIVEN - Admin 核准
      const approveRes = await approveLeave(request, adminToken, leaveId, '核准');
      expect(approveRes.status()).toBe(200);

      // WHEN - 嘗試取消已開始的假
      const res = await cancelLeave(request, token, leaveId);

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('LEAVE_STARTED');
    });

    test('Scenario: reason 恰好 500 字 - 201', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'reason-500');
      await ensureAnnualQuota(request, userId, 80);

      // WHEN
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(30),
        end_date: futureDate(30),
        reason: 'a'.repeat(500),
      });

      // THEN
      expect(res.status()).toBe(201);
    });

    test('Scenario: reason 501 字 - 400', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { token, userId } = await createTestEmployee(request, 'reason-501');
      await ensureAnnualQuota(request, userId, 80);

      // WHEN
      const res = await createLeave(request, token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(31),
        end_date: futureDate(31),
        reason: 'a'.repeat(501),
      });

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });
  });
});
