import { PrismaClient, Prisma, Role, UserStatus, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const Decimal = Prisma.Decimal;

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('Seeding database...');

  // 建立部門
  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      name: '人資部',
      code: 'HR',
    },
  });

  const engDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      name: '工程部',
      code: 'ENG',
    },
  });

  const salesDept = await prisma.department.upsert({
    where: { code: 'SALES' },
    update: {},
    create: {
      name: '業務部',
      code: 'SALES',
    },
  });

  console.log('Departments created:', { hrDept, engDept, salesDept });

  // 建立使用者
  const adminHash = await bcrypt.hash('Admin123!', BCRYPT_ROUNDS);
  const managerHash = await bcrypt.hash('Manager123!', BCRYPT_ROUNDS);
  const employeeHash = await bcrypt.hash('Employee123!', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      employeeId: 'EMP001',
      email: 'admin@company.com',
      passwordHash: adminHash,
      name: '系統管理員',
      role: Role.ADMIN,
      departmentId: hrDept.id,
      hireDate: new Date('2024-01-01'),
      status: UserStatus.ACTIVE,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: {},
    create: {
      employeeId: 'EMP002',
      email: 'manager@company.com',
      passwordHash: managerHash,
      name: '工程部主管',
      role: Role.MANAGER,
      departmentId: engDept.id,
      hireDate: new Date('2024-01-15'),
      status: UserStatus.ACTIVE,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: {},
    create: {
      employeeId: 'EMP003',
      email: 'employee@company.com',
      passwordHash: employeeHash,
      name: '一般員工',
      role: Role.EMPLOYEE,
      departmentId: engDept.id,
      managerId: manager.id,
      hireDate: new Date('2024-03-01'),
      status: UserStatus.ACTIVE,
    },
  });

  console.log('Users created:', {
    admin: admin.email,
    manager: manager.email,
    employee: employee.email,
  });

  // 設定工程部主管
  await prisma.department.update({
    where: { id: engDept.id },
    data: { managerId: manager.id },
  });

  // 建立 2026 年度假別額度
  const QUOTA_YEAR = 2026;
  const DEFAULT_HOURS: Record<string, number> = {
    PERSONAL: 56,
    SICK: 240,
    MARRIAGE: 64,
    BEREAVEMENT: 24,
    MATERNITY: 448,
    PATERNITY: 56,
    OFFICIAL: 9999,
  };

  function calculateAnnualHours(hireDate: Date, year: number): number {
    const yearStart = new Date(year, 0, 1);
    const diffMs = yearStart.getTime() - hireDate.getTime();
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears < 0.5) return 0;
    if (diffYears < 1) return 24;
    if (diffYears < 2) return 56;
    if (diffYears < 3) return 80;
    if (diffYears < 5) return 112;
    if (diffYears < 10) return 120;
    const extraYears = Math.floor(diffYears) - 10;
    return Math.min(128 + extraYears * 8, 240);
  }

  const allUsers = [
    { user: admin, hireDate: new Date('2024-01-01') },
    { user: manager, hireDate: new Date('2024-01-15') },
    { user: employee, hireDate: new Date('2024-03-01') },
  ];

  const leaveTypes = Object.values(LeaveType);

  for (const { user: u, hireDate } of allUsers) {
    for (const lt of leaveTypes) {
      let totalHours = DEFAULT_HOURS[lt] ?? 0;
      if (lt === 'ANNUAL') {
        totalHours = calculateAnnualHours(hireDate, QUOTA_YEAR);
      }

      await prisma.leaveQuota.upsert({
        where: {
          userId_leaveType_year: {
            userId: u.id,
            leaveType: lt,
            year: QUOTA_YEAR,
          },
        },
        update: {},
        create: {
          userId: u.id,
          leaveType: lt,
          year: QUOTA_YEAR,
          totalHours: new Decimal(totalHours),
          usedHours: new Decimal(0),
        },
      });
    }
  }

  console.log('Leave quotas created for year', QUOTA_YEAR);

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
