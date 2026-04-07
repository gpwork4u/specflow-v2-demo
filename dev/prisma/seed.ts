import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
