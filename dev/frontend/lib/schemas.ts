import { z } from "zod";

// Employee form schema
export const employeeFormSchema = z.object({
  employee_id: z
    .string()
    .min(1, "員工編號為必填")
    .max(20, "員工編號最多 20 個字元"),
  email: z
    .string()
    .min(1, "Email 為必填")
    .email("請輸入有效的 Email"),
  name: z
    .string()
    .min(1, "姓名為必填")
    .max(100, "姓名最多 100 個字元"),
  role: z.enum(["employee", "manager", "admin"], {
    required_error: "請選擇角色",
  }),
  department_id: z.string().min(1, "請選擇部門"),
  manager_id: z.string().optional(),
  hire_date: z.string().min(1, "請選擇到職日"),
  password: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

// Create employee schema (password required)
export const createEmployeeSchema = employeeFormSchema.extend({
  password: z
    .string()
    .min(8, "密碼至少 8 個字元"),
});

export type CreateEmployeeValues = z.infer<typeof createEmployeeSchema>;

// Department form schema
export const departmentFormSchema = z.object({
  name: z
    .string()
    .min(1, "部門名稱為必填")
    .max(100, "部門名稱最多 100 個字元"),
  code: z
    .string()
    .min(1, "部門代碼為必填")
    .max(20, "部門代碼最多 20 個字元")
    .regex(/^[a-zA-Z0-9-]+$/, "僅允許英數字和連字號"),
  manager_id: z.string().optional(),
  parent_id: z.string().optional(),
});

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;
