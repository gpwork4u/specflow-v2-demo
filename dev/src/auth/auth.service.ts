import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { v4 as uuidv4 } from 'uuid';

/** 連續登入失敗上限 */
const MAX_FAILED_ATTEMPTS = 5;
/** 帳號鎖定時間（分鐘） */
const LOCK_DURATION_MINUTES = 15;
/** bcrypt cost factor */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 登入：驗證 email + password，回傳 tokens + user 資訊
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // 帳號不存在 — 統一回傳 INVALID_CREDENTIALS
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '帳號或密碼錯誤',
      });
    }

    // 帳號狀態檢查：suspended / inactive
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: '帳號已被停用，請聯繫管理員',
      });
    }
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: '帳號已停用',
      });
    }

    // 帳號鎖定檢查
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: `帳號已鎖定，請於 ${LOCK_DURATION_MINUTES} 分鐘後再試`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 密碼驗證
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '帳號或密碼錯誤',
      });
    }

    // 登入成功，重置失敗計數
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 產生 tokens
    const tokens = await this.generateTokens(user.id, user.role, user.departmentId);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.getAccessTokenExpiresInSeconds(),
      user: {
        id: user.id,
        employee_id: user.employeeId,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
        department: {
          id: user.department.id,
          name: user.department.name,
        },
      },
    };
  }

  /**
   * 刷新 Token：驗證 refresh_token，發新的 access_token + refresh_token
   */
  async refresh(refreshTokenValue: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: {
        user: {
          select: { id: true, role: true, departmentId: true, status: true },
        },
      },
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Refresh token 無效或已過期',
      });
    }

    if (tokenRecord.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Refresh token 無效或已過期',
      });
    }

    // 撤銷舊的 refresh token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    // 產生新 tokens
    const tokens = await this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.role,
      tokenRecord.user.departmentId,
    );

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.getAccessTokenExpiresInSeconds(),
    };
  }

  /**
   * 登出：撤銷該使用者所有未過期的 refresh tokens
   */
  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: { revoked: true },
    });
  }

  /**
   * 取得當前使用者完整資料
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '使用者不存在',
      });
    }

    return {
      id: user.id,
      employee_id: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      department: {
        id: user.department.id,
        name: user.department.name,
      },
      manager: user.manager
        ? {
            id: user.manager.id,
            name: user.manager.name,
            email: user.manager.email,
          }
        : null,
      hire_date: user.hireDate.toISOString().split('T')[0],
      status: user.status.toLowerCase(),
    };
  }

  /**
   * 變更密碼
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    // 新舊密碼相同檢查
    if (dto.current_password === dto.new_password) {
      throw new HttpException(
        {
          code: 'SAME_PASSWORD',
          message: '新密碼不可與目前密碼相同',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '使用者不存在',
      });
    }

    // 驗證目前密碼
    const isPasswordValid = await bcrypt.compare(dto.current_password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '目前密碼錯誤',
      });
    }

    // 更新密碼
    const newHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: '密碼變更成功' };
  }

  // ── Private Methods ──

  /**
   * 處理登入失敗：遞增失敗計數，達到上限時鎖定帳號
   */
  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const newAttempts = currentAttempts + 1;
    const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
      failedLoginAttempts: newAttempts,
    };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * 產生 access token + refresh token
   */
  private async generateTokens(userId: string, role: string, departmentId: string) {
    const payload = {
      sub: userId,
      role,
      department_id: departmentId,
    };

    const accessToken = this.jwtService.sign(payload);

    // Refresh token: 使用 UUID 作為不透明 token，存入 DB
    const refreshToken = uuidv4();
    const refreshExpiresIn = this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN',
      604800,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * 取得 access token 有效秒數
   */
  private getAccessTokenExpiresInSeconds(): number {
    return this.configService.get<number>('JWT_EXPIRES_IN', 86400);
  }
}
