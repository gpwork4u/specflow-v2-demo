/**
 * 測試資料常數
 * 所有 test case 共用的測試帳號、部門、員工等資料
 */

// ===== 認證相關 =====

/** 預設管理員帳號（系統 seed 資料） */
export const ADMIN_USER = {
  email: 'admin@company.com',
  password: 'Admin123!@#',
  name: '系統管理員',
  role: 'admin' as const,
};

/** 一般員工帳號 */
export const EMPLOYEE_USER = {
  email: 'employee@company.com',
  password: 'Employee123!',
  name: '測試員工',
  role: 'employee' as const,
};

/** 主管帳號 */
export const MANAGER_USER = {
  email: 'manager@company.com',
  password: 'Manager123!',
  name: '測試主管',
  role: 'manager' as const,
};

/** 停用帳號（用於測試 ACCOUNT_SUSPENDED） */
export const SUSPENDED_USER = {
  email: 'suspended@company.com',
  password: 'Suspended123!',
  name: '停用帳號',
};

/** 用於鎖定測試的帳號 */
export const LOCKOUT_USER = {
  email: 'lockout@company.com',
  password: 'Lockout123!',
  name: '鎖定測試帳號',
};

// ===== 部門相關 =====

export const TEST_DEPARTMENT = {
  name: '工程部',
  code: 'ENG',
};

export const TEST_DEPARTMENT_2 = {
  name: '人資部',
  code: 'HR',
};

export const TEST_DEPARTMENT_EMPTY = {
  name: '空部門-測試用',
  code: 'EMPTY-TEST',
};

// ===== 員工相關 =====

export const NEW_EMPLOYEE = {
  employee_id: 'EMP-TEST-001',
  email: 'new-emp@company.com',
  password: 'NewEmp123!',
  name: '新員工測試',
  role: 'employee' as const,
  hire_date: '2026-04-01',
};

export const NEW_EMPLOYEE_2 = {
  employee_id: 'EMP-TEST-002',
  email: 'new-emp2@company.com',
  password: 'NewEmp123!',
  name: '王小明',
  role: 'employee' as const,
  hire_date: '2024-03-01',
};

// ===== API 路徑 =====

export const API = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
    PASSWORD: '/api/v1/auth/password',
  },
  DEPARTMENTS: '/api/v1/departments',
  EMPLOYEES: '/api/v1/employees',
  CLOCK: {
    IN: '/api/v1/clock/in',
    OUT: '/api/v1/clock/out',
    TODAY: '/api/v1/clock/today',
    RECORDS: '/api/v1/clock/records',
  },
} as const;

// ===== 密碼測試 =====

export const PASSWORDS = {
  VALID_NEW: 'NewPass456!',
  WRONG: 'WrongPassword99!',
  TOO_SHORT: 'short',
};

// ===== 分頁預設值 =====

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
};
