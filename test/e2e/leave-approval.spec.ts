import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsEmployee,
  loginAsManager,
  login,
  authHeaders,
  createEmployee,
  createLeave,
  createLeaveAndGetId,
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  getMyQuotas,
  setEmployeeQuotas,
} from '../helpers/api-client';
import {
  API,
  LEAVE_TYPES,
  LEAVE_STATUS,
  futureDate,
  MANAGER_USER,
} from '../helpers/test-data';

const FEATURE = 'F-003';

test.describe(`[${FEATURE}] 主管審核請假 - API E2E`, () => {
  let adminToken: string;
  let managerToken: string;
  let managerUserId: string;
  let testDeptId: string;
  let testDept2Id: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;
    managerUserId = mgrLogin.user.id;

    // 取得測試部門
    const deptRes = await request.get(API.DEPARTMENTS, {
      headers: authHeaders(adminToken),
    });
    const depts = await deptRes.json();
    testDeptId = depts.data?.[0]?.id;
    testDept2Id = depts.data?.[1]?.id;
  });

  /**
   * 建立直屬部屬（和 manager 同部門）並登入
   */
  async function createSubordinate(
    request: any,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const ts = Date.now();
    const email = `sub-${suffix}-${ts}@company.com`;
    const password = 'SubTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `SUB-${suffix}-${ts}`,
      email,
      password,
      name: `部屬-${suffix}`,
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
   * 建立另一部門的員工（非直屬）
   */
  async function createOtherDeptEmployee(
    request: any,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    test.skip(!testDept2Id, '無第二個部門');
    const ts = Date.now();
    const email = `other-${suffix}-${ts}@company.com`;
    const password = 'OtherTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `OTH-${suffix}-${ts}`,
      email,
      password,
      name: `他部門-${suffix}`,
      role: 'employee',
      department_id: testDept2Id,
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
   * 建立一筆 pending 請假（直屬部屬），回傳 leaveId
   */
  async function createSubordinateLeave(
    request: any,
    suffix: string,
  ): Promise<{ leaveId: string; subToken: string; subUserId: string }> {
    const sub = await createSubordinate(request, suffix);
    await setEmployeeQuotas(request, adminToken, sub.userId, {
      year: 2026,
      quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
    });

    const leaveId = await createLeaveAndGetId(request, sub.token, {
      leave_type: LEAVE_TYPES.ANNUAL,
      start_date: futureDate(10),
      end_date: futureDate(10),
      reason: `測試假單-${suffix}`,
    });

    return { leaveId, subToken: sub.token, subUserId: sub.userId };
  }

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 查看待審核清單 - 200', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // GIVEN - 建立一筆部屬請假
      await createSubordinateLeave(request, 'pending-list');

      // WHEN
      const res = await getPendingLeaves(request, managerToken);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body).toHaveProperty('meta');

      // AND 所有紀錄都是 pending 狀態
      for (const leave of body.data) {
        expect(leave.status).toBe(LEAVE_STATUS.PENDING);
        expect(leave).toHaveProperty('user');
        expect(leave.user).toHaveProperty('name');
        expect(leave).toHaveProperty('leave_type');
        expect(leave).toHaveProperty('hours');
      }
    });

    test('Scenario: 核准請假 - 200 + status=approved + 額度扣除', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { leaveId, subToken, subUserId } = await createSubordinateLeave(request, 'approve');

      // 記錄核准前的額度
      const quotaBefore = await getMyQuotas(request, subToken, 2026);
      const beforeBody = await quotaBefore.json();
      const annualBefore = beforeBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );

      // WHEN
      const res = await approveLeave(request, managerToken, leaveId, '核准');

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id', leaveId);
      expect(body).toHaveProperty('status', LEAVE_STATUS.APPROVED);
      expect(body).toHaveProperty('reviewer');
      expect(body.reviewer).toHaveProperty('id');
      expect(body.reviewer).toHaveProperty('name');
      expect(body).toHaveProperty('reviewed_at');

      // AND 額度扣除
      const quotaAfter = await getMyQuotas(request, subToken, 2026);
      const afterBody = await quotaAfter.json();
      const annualAfter = afterBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annualAfter.used_hours).toBeGreaterThan(annualBefore.used_hours);
      expect(annualAfter.remaining_hours).toBeLessThan(annualBefore.remaining_hours);
    });

    test('Scenario: 駁回請假 - 200 + status=rejected + 額度不變', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { leaveId, subToken } = await createSubordinateLeave(request, 'reject');

      // 記錄駁回前的額度
      const quotaBefore = await getMyQuotas(request, subToken, 2026);
      const beforeBody = await quotaBefore.json();
      const annualBefore = beforeBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );

      // WHEN
      const rejectComment = '該週有重要專案 deadline';
      const res = await rejectLeave(request, managerToken, leaveId, rejectComment);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id', leaveId);
      expect(body).toHaveProperty('status', LEAVE_STATUS.REJECTED);
      expect(body).toHaveProperty('review_comment', rejectComment);
      expect(body).toHaveProperty('reviewer');

      // AND 額度不變
      const quotaAfter = await getMyQuotas(request, subToken, 2026);
      const afterBody = await quotaAfter.json();
      const annualAfter = afterBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annualAfter.used_hours).toBe(annualBefore.used_hours);
      expect(annualAfter.remaining_hours).toBe(annualBefore.remaining_hours);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 員工嘗試審核 - 403', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { leaveId } = await createSubordinateLeave(request, 'emp-approve');

      // GIVEN - 一般員工
      const emp = await createSubordinate(request, 'emp-try-approve');

      // WHEN
      const res = await approveLeave(request, emp.token, leaveId);

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: 主管審核非直屬部屬 - 403', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      test.skip(!testDept2Id, '無第二個部門');

      // GIVEN - 建立另一部門員工的請假
      const other = await createOtherDeptEmployee(request, 'other-dept');
      await setEmployeeQuotas(request, adminToken, other.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
      });
      const leaveId = await createLeaveAndGetId(request, other.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(15),
        end_date: futureDate(15),
        reason: '他部門請假',
      });

      // WHEN - 主管嘗試審核非直屬
      const res = await approveLeave(request, managerToken, leaveId);

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: 駁回不填原因 - 400', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { leaveId } = await createSubordinateLeave(request, 'reject-empty');

      // WHEN - 空的 comment
      const res = await rejectLeave(request, managerToken, leaveId, '');

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: 審核已處理的請假單 - 422 NOT_PENDING', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const { leaveId } = await createSubordinateLeave(request, 'already-done');

      // GIVEN - 先核准
      const approveRes = await approveLeave(request, managerToken, leaveId, '核准');
      expect(approveRes.status()).toBe(200);

      // WHEN - 再次核准
      const res = await approveLeave(request, managerToken, leaveId, '再核准');

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('NOT_PENDING');
    });

    test('Scenario: 審核不存在的請假單 - 404', async ({ request }) => {
      // WHEN
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await approveLeave(request, managerToken, fakeId);

      // THEN
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 主管審核自己的請假 - 403', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // GIVEN - 主管自己建立一筆請假
      await setEmployeeQuotas(request, adminToken, managerUserId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
      });
      const leaveId = await createLeaveAndGetId(request, managerToken, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(30),
        end_date: futureDate(30),
        reason: '主管自己的假',
      });

      // WHEN - 主管嘗試審核自己
      const res = await approveLeave(request, managerToken, leaveId);

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    test('Scenario: Admin 審核任意部門 - 200', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // WHEN - Admin 查看指定部門的待審核
      const res = await getPendingLeaves(request, adminToken, {
        department_id: testDeptId,
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('Scenario: 核准後額度剛好歸零', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // GIVEN - 建立部屬，額度設為剛好 8h
      const sub = await createSubordinate(request, 'zero-quota');
      await setEmployeeQuotas(request, adminToken, sub.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 8 }],
      });

      const leaveId = await createLeaveAndGetId(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(20),
        end_date: futureDate(20),
        reason: '用完額度',
      });

      // WHEN
      const res = await approveLeave(request, managerToken, leaveId, '核准');

      // THEN
      expect(res.status()).toBe(200);

      // AND 額度歸零
      const quotaRes = await getMyQuotas(request, sub.token, 2026);
      const quotaBody = await quotaRes.json();
      const annualQuota = quotaBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annualQuota.remaining_hours).toBe(0);
      expect(annualQuota.used_hours).toBe(annualQuota.total_hours);
    });
  });

  // =============================================
  // 跨 Feature 整合測試
  // =============================================
  test.describe('Integration', () => {
    test('完整請假流程: 申請 -> 核准 -> 額度扣除 -> 查看更新後額度', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const sub = await createSubordinate(request, 'full-flow');
      await setEmployeeQuotas(request, adminToken, sub.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
      });

      // Step 1: 員工申請
      const leaveId = await createLeaveAndGetId(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(14),
        end_date: futureDate(14),
        reason: '整合測試',
      });

      // Step 2: 主管核准
      const approveRes = await approveLeave(request, managerToken, leaveId, '核准');
      expect(approveRes.status()).toBe(200);

      // Step 3: 員工查看額度已扣除
      const quotaRes = await getMyQuotas(request, sub.token, 2026);
      const quotaBody = await quotaRes.json();
      const annual = quotaBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annual.used_hours).toBe(8);
      expect(annual.remaining_hours).toBe(72);
    });

    test('駁回流程: 申請 -> 駁回 -> 額度不變', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const sub = await createSubordinate(request, 'reject-flow');
      await setEmployeeQuotas(request, adminToken, sub.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
      });

      // Step 1: 申請
      const leaveId = await createLeaveAndGetId(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(16),
        end_date: futureDate(16),
        reason: '駁回測試',
      });

      // Step 2: 駁回
      const rejectRes = await rejectLeave(request, managerToken, leaveId, '人力不足');
      expect(rejectRes.status()).toBe(200);

      // Step 3: 額度不變
      const quotaRes = await getMyQuotas(request, sub.token, 2026);
      const quotaBody = await quotaRes.json();
      const annual = quotaBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annual.used_hours).toBe(0);
      expect(annual.remaining_hours).toBe(80);
    });

    test('取消已核准流程: 申請 -> 核准 -> 取消 -> 額度退還', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const sub = await createSubordinate(request, 'cancel-approved-flow');
      await setEmployeeQuotas(request, adminToken, sub.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80 }],
      });

      // Step 1: 申請（未來的日期）
      const leaveDate = futureDate(28);
      const leaveId = await createLeaveAndGetId(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: leaveDate,
        end_date: leaveDate,
        reason: '取消測試',
      });

      // Step 2: 核准
      const approveRes = await approveLeave(request, managerToken, leaveId, '核准');
      expect(approveRes.status()).toBe(200);

      // Step 3: 取消
      const { cancelLeave: cancelLeaveFn } = await import('../helpers/api-client');
      const cancelRes = await request.put(`${API.LEAVES.BASE}/${leaveId}/cancel`, {
        headers: authHeaders(sub.token),
      });
      expect(cancelRes.status()).toBe(200);

      // Step 4: 額度退還
      const quotaRes = await getMyQuotas(request, sub.token, 2026);
      const quotaBody = await quotaRes.json();
      const annual = quotaBody.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annual.used_hours).toBe(0);
      expect(annual.remaining_hours).toBe(80);
    });

    test('額度邊界整合: 設定額度 -> 申請到用完 -> 再申請被拒', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const sub = await createSubordinate(request, 'quota-boundary');
      // 只給 8h (1 天) 的額度
      await setEmployeeQuotas(request, adminToken, sub.userId, {
        year: 2026,
        quotas: [{ leave_type: LEAVE_TYPES.ANNUAL, total_hours: 8 }],
      });

      // Step 1: 申請 1 天
      const leaveId = await createLeaveAndGetId(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(20),
        end_date: futureDate(20),
        reason: '用完額度',
      });

      // Step 2: 核准
      const approveRes = await approveLeave(request, managerToken, leaveId, '核准');
      expect(approveRes.status()).toBe(200);

      // Step 3: 再申請 1 天 -> 應被拒
      const secondRes = await createLeave(request, sub.token, {
        leave_type: LEAVE_TYPES.ANNUAL,
        start_date: futureDate(25),
        end_date: futureDate(25),
        reason: '額度不足',
      });

      expect(secondRes.status()).toBe(422);
      const body = await secondRes.json();
      expect(body.code).toBe('INSUFFICIENT_QUOTA');
    });
  });
});
