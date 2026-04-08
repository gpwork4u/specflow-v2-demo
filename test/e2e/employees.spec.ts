import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsManager,
  login,
  createDepartment,
  createEmployee,
  authHeaders,
} from '../helpers/api-client';
import { API, MANAGER_USER } from '../helpers/test-data';

const FEATURE = 'F-008';

test.describe(`[${FEATURE}] 員工管理 - API E2E`, () => {
  let adminToken: string;
  let testDeptId: string;
  let testDept2Id: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAsAdmin(request);
    adminToken = loginRes.access_token;

    // 建立測試用部門
    const dept1Res = await createDepartment(request, adminToken, {
      name: `員工測試部-${Date.now()}`,
      code: `EMPT-${Date.now()}`,
    });
    if (dept1Res.ok()) {
      const dept1 = await dept1Res.json();
      testDeptId = dept1.id;
    }

    const dept2Res = await createDepartment(request, adminToken, {
      name: `員工測試部2-${Date.now()}`,
      code: `EMPT2-${Date.now()}`,
    });
    if (dept2Res.ok()) {
      const dept2 = await dept2Res.json();
      testDept2Id = dept2.id;
    }
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 建立員工 - 201 + status=active', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const ts = Date.now();

      // WHEN
      const res = await createEmployee(request, adminToken, {
        employee_id: `EMP-C-${ts}`,
        email: `create-emp-${ts}@company.com`,
        password: 'CreateEmp123!',
        name: '新建員工',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('employee_id', `EMP-C-${ts}`);
      expect(body).toHaveProperty('email', `create-emp-${ts}@company.com`);
      expect(body).toHaveProperty('name', '新建員工');
      expect(body).toHaveProperty('status', 'active');
      expect(body).toHaveProperty('department');
      expect(body.department).toHaveProperty('id', testDeptId);
    });

    test('Scenario: 搜尋員工 - 200 + 匹配結果', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const ts = Date.now();
      const searchName = `搜尋目標-${ts}`;

      // GIVEN - 建立有特定名稱的員工
      const createRes = await createEmployee(request, adminToken, {
        employee_id: `EMP-S-${ts}`,
        email: `search-${ts}@company.com`,
        password: 'SearchEmp123!',
        name: searchName,
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });
      expect(createRes.status()).toBe(201);

      // WHEN
      const res = await request.get(`${API.EMPLOYEES}?search=${encodeURIComponent(searchName)}`, {
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const found = body.data.some((emp: any) => emp.name === searchName);
      expect(found).toBe(true);
      expect(body).toHaveProperty('meta');
    });

    test('Scenario: 更新員工部門 - 200', async ({ request }) => {
      test.skip(!testDeptId || !testDept2Id, '無足夠部門');
      const ts = Date.now();

      // GIVEN - 建立員工在部門 1
      const createRes = await createEmployee(request, adminToken, {
        employee_id: `EMP-UD-${ts}`,
        email: `upd-dept-${ts}@company.com`,
        password: 'UpdDept123!',
        name: '部門異動員工',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });
      expect(createRes.status()).toBe(201);
      const emp = await createRes.json();

      // WHEN - 更新到部門 2
      const res = await request.put(`${API.EMPLOYEES}/${emp.id}`, {
        data: { department_id: testDept2Id },
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.department.id).toBe(testDept2Id);
    });

    test('Scenario: 停用員工帳號 - 200 + 無法登入', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const ts = Date.now();
      const empEmail = `deact-${ts}@company.com`;
      const empPassword = 'Deactivate123!';

      // GIVEN - 建立員工
      const createRes = await createEmployee(request, adminToken, {
        employee_id: `EMP-DA-${ts}`,
        email: empEmail,
        password: empPassword,
        name: '停用測試員工',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });
      expect(createRes.status()).toBe(201);
      const emp = await createRes.json();

      // 確認可以登入
      const beforeLogin = await request.post(API.AUTH.LOGIN, {
        data: { email: empEmail, password: empPassword },
      });
      expect(beforeLogin.status()).toBe(200);

      // WHEN - 停用帳號
      const res = await request.put(`${API.EMPLOYEES}/${emp.id}`, {
        data: { status: 'inactive' },
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('inactive');

      // AND 無法登入
      const afterLogin = await request.post(API.AUTH.LOGIN, {
        data: { email: empEmail, password: empPassword },
      });
      expect([401, 403]).toContain(afterLogin.status());
    });

    test('Scenario: 重設員工密碼 - 200', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const ts = Date.now();
      const empEmail = `reset-pwd-${ts}@company.com`;
      const oldPassword = 'OldPass123!';
      const newPassword = 'ResetNew123!';

      // GIVEN
      const createRes = await createEmployee(request, adminToken, {
        employee_id: `EMP-RP-${ts}`,
        email: empEmail,
        password: oldPassword,
        name: '重設密碼員工',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });
      expect(createRes.status()).toBe(201);
      const emp = await createRes.json();

      // WHEN
      const res = await request.put(`${API.EMPLOYEES}/${emp.id}/reset-password`, {
        data: { new_password: newPassword },
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);

      // AND 新密碼可登入
      const loginRes = await request.post(API.AUTH.LOGIN, {
        data: { email: empEmail, password: newPassword },
      });
      expect(loginRes.status()).toBe(200);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 重複員工編號 - 409 DUPLICATE_EMPLOYEE_ID', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const ts = Date.now();
      const empId = `EMP-DUP-${ts}`;

      // GIVEN - 先建立一個員工
      const createRes = await createEmployee(request, adminToken, {
        employee_id: empId,
        email: `dup1-${ts}@company.com`,
        password: 'DupTest123!',
        name: '重複編號1',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });
      expect(createRes.status()).toBe(201);

      // WHEN - 用同樣的 employee_id 再建一個
      const res = await createEmployee(request, adminToken, {
        employee_id: empId,
        email: `dup2-${ts}@company.com`,
        password: 'DupTest123!',
        name: '重複編號2',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });

      // THEN
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('DUPLICATE_EMPLOYEE_ID');
    });

    test('Scenario: 非 Admin 嘗試管理員工 - 403 FORBIDDEN', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // GIVEN - 以 manager 身份登入
      let managerToken: string;
      try {
        const managerLogin = await loginAsManager(request);
        managerToken = managerLogin.access_token;
      } catch {
        test.skip(true, '主管帳號不存在');
        return;
      }

      // WHEN
      const res = await createEmployee(request, managerToken, {
        employee_id: `EMP-FORB-${Date.now()}`,
        email: `forbidden-${Date.now()}@company.com`,
        password: 'Forbidden123!',
        name: '非admin建立',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-01',
      });

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });
  });
});
