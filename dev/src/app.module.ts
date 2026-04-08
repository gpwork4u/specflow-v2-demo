import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { ClockModule } from './clock/clock.module';
import { LeaveQuotasModule } from './leave-quotas/leave-quotas.module';
import { LeavesModule } from './leaves/leaves.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    DepartmentsModule,
    EmployeesModule,
    ClockModule,
    LeaveQuotasModule,
    LeavesModule,
  ],
})
export class AppModule {}
