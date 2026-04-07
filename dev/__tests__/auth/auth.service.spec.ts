import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-refresh-token-uuid'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };

  const mockUser = {
    id: 'user-uuid-1',
    employeeId: 'EMP001',
    email: 'admin@company.com',
    passwordHash: '$2b$10$hashedpassword',
    name: '系統管理員',
    role: 'ADMIN',
    departmentId: 'dept-uuid-1',
    managerId: null,
    hireDate: new Date('2024-01-01'),
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    department: { id: 'dept-uuid-1', name: '人資部' },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: unknown) => {
              const config: Record<string, unknown> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: 86400,
                JWT_REFRESH_EXPIRES_IN: 604800,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens and user info on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({});
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@company.com',
        password: 'Admin123!',
      });

      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token-uuid');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(86400);
      expect(result.user.id).toBe('user-uuid-1');
      expect(result.user.email).toBe('admin@company.com');
      expect(result.user.role).toBe('admin');
      expect(result.user.department.name).toBe('人資部');
    });

    it('should throw INVALID_CREDENTIALS when email not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@company.com',
          password: 'anyPass123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login({
          email: 'nonexistent@company.com',
          password: 'anyPass123',
        });
      } catch (e) {
        const exception = e as HttpException;
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw INVALID_CREDENTIALS when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'admin@company.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ACCOUNT_SUSPENDED when user is suspended', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        service.login({
          email: 'admin@company.com',
          password: 'Admin123!',
        }),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.login({
          email: 'admin@company.com',
          password: 'Admin123!',
        });
      } catch (e) {
        const exception = e as HttpException;
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('ACCOUNT_SUSPENDED');
      }
    });

    it('should throw ACCOUNT_LOCKED when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      };
      prisma.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        service.login({
          email: 'admin@company.com',
          password: 'Admin123!',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.login({
          email: 'admin@company.com',
          password: 'Admin123!',
        });
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('ACCOUNT_LOCKED');
      }
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Failures = {
        ...mockUser,
        failedLoginAttempts: 4,
      };
      prisma.user.findUnique.mockResolvedValue(userWith4Failures);
      prisma.user.update.mockResolvedValue(userWith4Failures);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'admin@company.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      // Verify that update was called with lockedUntil set
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      });
    });

    it('should reset failed attempts on successful login', async () => {
      const userWithFailures = {
        ...mockUser,
        failedLoginAttempts: 3,
      };
      prisma.user.findUnique.mockResolvedValue(userWithFailures);
      prisma.user.update.mockResolvedValue(userWithFailures);
      prisma.refreshToken.create.mockResolvedValue({});
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({
        email: 'admin@company.com',
        password: 'Admin123!',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });

  describe('refresh', () => {
    const mockTokenRecord = {
      id: 'token-uuid-1',
      token: 'valid-refresh-token',
      userId: 'user-uuid-1',
      revoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: {
        id: 'user-uuid-1',
        role: 'ADMIN',
        departmentId: 'dept-uuid-1',
        status: 'ACTIVE',
      },
    };

    it('should return new tokens on valid refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-refresh-token');

      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token-uuid');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(86400);
    });

    it('should revoke old refresh token on refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refresh('valid-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-1' },
        data: { revoked: true },
      });
    });

    it('should throw INVALID_TOKEN for revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockTokenRecord,
        revoked: true,
      });

      await expect(service.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw INVALID_TOKEN for expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw INVALID_TOKEN when token not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nonexistent-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens for user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.logout('user-uuid-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', revoked: false },
        data: { revoked: true },
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile with department and manager', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        manager: { id: 'manager-uuid', name: '主管', email: 'manager@company.com' },
      });

      const result = await service.getProfile('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('admin@company.com');
      expect(result.role).toBe('admin');
      expect(result.department.name).toBe('人資部');
      expect(result.manager).toEqual({
        id: 'manager-uuid',
        name: '主管',
        email: 'manager@company.com',
      });
      expect(result.hire_date).toBe('2024-01-01');
    });

    it('should return null manager when user has no manager', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        manager: null,
      });

      const result = await service.getProfile('user-uuid-1');
      expect(result.manager).toBeNull();
    });

    it('should throw UNAUTHORIZED when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-uuid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        passwordHash: '$2b$10$oldHash',
      });
      prisma.user.update.mockResolvedValue({});
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newHash');

      const result = await service.changePassword('user-uuid-1', {
        current_password: 'oldPass123',
        new_password: 'newPass456',
      });

      expect(result.message).toBe('密碼變更成功');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { passwordHash: '$2b$10$newHash' },
      });
    });

    it('should throw SAME_PASSWORD when new equals current', async () => {
      await expect(
        service.changePassword('user-uuid-1', {
          current_password: 'samePass123',
          new_password: 'samePass123',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.changePassword('user-uuid-1', {
          current_password: 'samePass123',
          new_password: 'samePass123',
        });
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('SAME_PASSWORD');
      }
    });

    it('should throw INVALID_CREDENTIALS when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        passwordHash: '$2b$10$oldHash',
      });
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-uuid-1', {
          current_password: 'wrongOldPass',
          new_password: 'newPass456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
