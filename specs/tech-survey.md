# 技術選型調查報告

## 調查日期
2026-04-07

## 1. 後端框架 — NestJS

### 候選方案
| 方案 | 版本 | Stars | 優點 | 缺點 | 適用場景 |
|------|------|-------|------|------|---------|
| NestJS | 11.x (11.1.18) | 70k+ | 模組化架構、TypeScript 原生、Passport/JWT 整合成熟、大量 decorator 簡化開發 | 學習曲線較陡、bundle 較大 | 企業級 API 服務 |
| Express.js | 5.x | 65k+ | 輕量、生態龐大 | 無內建結構、需自行組織 | 小型 API |
| Fastify | 5.x | 33k+ | 效能最佳、schema 驗證 | 生態較小、NestJS 可用 Fastify adapter | 高效能 API |

### 決策
選擇 **NestJS 11.x**
- 理由：Spec 已指定 NestJS。v11 改進了模組啟動效能（opaque key 改用 object reference）、新增 ParseDatePipe、改進 Logger。
- NestJS 11 的模組化架構（Module / Controller / Service / Guard）天然適合 HR 系統的多角色權限管理。

### 認證方案
| 方案 | 優點 | 缺點 |
|------|------|------|
| @nestjs/passport + passport-jwt | 官方推薦、策略模式可擴展、文件豐富 | 多一層抽象 |
| 自製 JWT Guard | 更輕量 | 需自行處理所有邊界情況 |

**決策**：使用 **@nestjs/passport + passport-jwt + @nestjs/jwt**
- NestJS 官方文件推薦此組合
- JwtAuthGuard 搭配 @UseGuards() decorator 保護路由
- JWT payload 包含 user_id, role, department_id
- Access Token 24h / Refresh Token 7d（存 DB，登出時 invalidate）
- 密碼使用 bcrypt（cost factor 10+）

### Module 結構建議
```
dev/src/
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   └── dto/
│       ├── login.dto.ts
│       └── refresh-token.dto.ts
├── employees/
│   ├── employees.module.ts
│   ├── employees.controller.ts
│   ├── employees.service.ts
│   └── dto/
├── departments/
│   ├── departments.module.ts
│   ├── departments.controller.ts
│   ├── departments.service.ts
│   └── dto/
├── clock/
│   ├── clock.module.ts
│   ├── clock.controller.ts
│   ├── clock.service.ts
│   └── dto/
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── common/
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── transform.interceptor.ts
    ├── pipes/
    │   └── validation.pipe.ts
    └── dto/
        └── pagination.dto.ts
```

## 2. 前端框架 — Next.js

### 候選方案
| 方案 | 版本 | Stars | 優點 | 缺點 | 適用場景 |
|------|------|-------|------|------|---------|
| Next.js | 16.x (16.2.2) | 130k+ | SSR/SSG、App Router、React Server Components、Turbopack 穩定 | 與獨立後端搭配時 SSR 優勢有限 | 全端 / 前端應用 |
| Remix | 3.x | 30k+ | Web 標準、nested routes | 生態較小 | 表單密集應用 |
| Vite + React | - | - | 輕量、快速 HMR | 無 SSR 框架支援 | SPA |

### 決策
選擇 **Next.js 16.x**
- Spec 已指定。v16 Turbopack 穩定（dev + build）、App Router 成熟、React 19.2 支援。
- 本專案後端為獨立 NestJS，Next.js 主要作為前端 SPA + PWA 使用，使用 App Router + Client Components 為主。
- 前端透過 fetch / axios 呼叫 NestJS API，不使用 Next.js Server Actions 操作資料庫。

## 3. PWA 方案

### 候選方案
| 方案 | 狀態 | 優點 | 缺點 |
|------|------|------|------|
| Next.js 內建 PWA（手動配置） | 官方支援 | 零依賴、完全掌控 Service Worker | 需手動撰寫 SW 邏輯 |
| @serwist/next（Serwist） | 活躍維護 | next-pwa 後繼者、進階快取策略、離線支援完善 | 多一個依賴 |
| @ducanh2912/next-pwa | 活躍維護 | next-pwa fork、設定簡單 | 功能較 Serwist 少 |

### 決策
選擇 **@serwist/next（Serwist）**
- 理由：HR 工時系統需要離線查看最近打卡紀錄（spec 非功能需求），Serwist 提供完善的快取策略和背景同步能力。
- Serwist 是 next-pwa 的現代化後繼，與 Next.js 16 App Router 相容。
- 提供 IndexedDB 整合、離線偵測、基本同步機制。

## 4. UI 元件庫

### 候選方案
| 方案 | 版本 | npm 下載/週 | 優點 | 缺點 | 適用場景 |
|------|------|------------|------|------|---------|
| shadcn/ui | latest | - (copy-paste) | Tailwind CSS 原生、完全可客製、Next.js 生態首選、輕量 | 元件數較少、需自行組合複雜元件 | 現代 Next.js 專案 |
| Ant Design | 6.x | 1.3M | 元件最豐富（60+）、企業級、ProComponents 快速建表格/表單 | bundle 大、設計風格較固定、中國市場導向 | 企業後台管理系統 |
| MUI | 6.x | 3.3M | 文件最完整、i18n 50+ 語言、MUI X 進階 DataGrid | 客製化需覆寫 theme、bundle 較大 | Material Design 風格專案 |

### 決策
選擇 **shadcn/ui + Tailwind CSS + Radix UI**
- 理由：
  1. 與 Next.js 16 + App Router 最佳整合
  2. Copy-paste 模式，元件程式碼在專案內，完全可控
  3. 基於 Radix UI primitive，WCAG 2.1 AA 無障礙支援
  4. Tailwind CSS 搭配 CSS variables 實現 design tokens
  5. HR 系統的 UI 複雜度適中，shadcn/ui 提供的表單、表格、對話框、導航等元件足夠
  6. 可搭配 @tanstack/react-table 實現進階表格功能
- 補充套件：
  - `@tanstack/react-table` — 員工列表、打卡紀錄等表格
  - `react-hook-form` + `zod` — 表單驗證
  - `date-fns` — 日期處理（UTC <-> Asia/Taipei）
  - `lucide-react` — 圖示

## 5. 資料庫 + ORM

### 資料庫
| 方案 | 優點 | 缺點 |
|------|------|------|
| PostgreSQL | ACID、JSON 支援、成熟穩定、免費 | 相較 MySQL 稍重 |
| MySQL | 輕量、廣泛使用 | JSON 支援較弱 |

**決策**：**PostgreSQL**（Spec 已指定）

### ORM
| 方案 | 版本 | npm 下載/週 | 優點 | 缺點 |
|------|------|------------|------|------|
| Prisma | 7.x | 2.5M | Schema-first、型別安全、Migration 工具完整、v7 純 TypeScript（移除 Rust engine）效能提升 3x | 抽象層較厚 |
| Drizzle | 0.4x | 900K | SQL-like API、極輕量 7.4KB、冷啟動快 | 生態較年輕、型別檢查較慢 |
| TypeORM | 0.3x | 1.5M | Decorator 風格與 NestJS 搭配自然 | 維護速度慢、型別安全不如 Prisma |

### 決策
選擇 **Prisma 7.x**
- Spec 已指定。v7 重大改進：移除 Rust query engine，純 TypeScript 實現，查詢延遲改善 3x。
- Schema-first 設計天然適合 HR 系統明確的資料模型（User, Department, ClockRecord 等）。
- `prisma migrate` 提供完整的 migration 管理。
- NestJS 整合：建立 PrismaService extends PrismaClient，在 AppModule 中全域提供。

### Prisma 配置建議
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

- Connection pool：預設 num_cpus * 2 + 1，Docker 環境建議 connection_limit=10
- 使用 singleton pattern 避免多個 PrismaClient 實例
- 生產環境使用 `prisma migrate deploy`（非互動式）

## 6. Docker Compose 配置

### 服務架構
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hr_system
      POSTGRES_USER: hr_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hr_user -d hr_system"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./dev
      dockerfile: Dockerfile
      target: development
    environment:
      DATABASE_URL: postgresql://hr_user:${DB_PASSWORD}@postgres:5432/hr_system
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: 86400
      JWT_REFRESH_EXPIRES_IN: 604800
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./dev/src:/app/src

  web:
    build:
      context: ./dev
      dockerfile: Dockerfile.frontend
      target: development
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - api
    volumes:
      - ./dev/src:/app/src

volumes:
  postgres_data:
```

### 建議
- PostgreSQL 使用 16-alpine（輕量）
- 多階段 Docker build（development / production target）
- Next.js 生產環境啟用 `output: "standalone"` 減少 image 大小
- NestJS 使用 `depends_on` + healthcheck 確保 DB 就緒後才啟動
- 開發環境掛載 volume 實現 hot reload

## 7. 其他 Library

| 用途 | 選擇 | 替代方案 | 選擇理由 |
|------|------|---------|---------|
| 表單驗證（前端） | react-hook-form + zod | Formik | 效能更好、與 TypeScript 整合佳 |
| 表單驗證（後端） | class-validator + class-transformer | zod | NestJS 官方推薦、Pipe 整合 |
| HTTP Client（前端） | axios | fetch | interceptor 方便處理 JWT refresh |
| 日期處理 | date-fns | dayjs / luxon | Tree-shakable、輕量 |
| 表格 | @tanstack/react-table | ag-grid | 免費、headless、搭配 shadcn/ui |
| 圖示 | lucide-react | heroicons | shadcn/ui 預設搭配 |
| 狀態管理 | zustand | Redux Toolkit | 輕量、適合中型應用 |
| API 快取 | @tanstack/react-query | SWR | 功能更完整、DevTools |
| 測試（單元） | Jest + ts-jest | Vitest | NestJS 預設整合 |
| 測試（E2E） | Playwright | Cypress | 多瀏覽器、速度快、spec 指定 |
| 密碼加密 | bcrypt | argon2 | 業界標準、NestJS 生態整合 |

## 8. 參考資料
- [NestJS Authentication 官方文件](https://docs.nestjs.com/security/authentication)
- [NestJS 11 發佈公告](https://trilon.io/blog/announcing-nestjs-11-whats-new)
- [Prisma Best Practices 官方文件](https://www.prisma.io/docs/orm/more/best-practices)
- [Prisma Deep-Dive Handbook 2025](https://dev.to/mihir_bhadak/prisma-deep-dive-handbook-2025-from-zero-to-expert-1761)
- [Prisma vs Drizzle 2026 比較](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Next.js PWA 官方指南](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Serwist PWA 整合教學](https://javascript.plainenglish.io/building-a-progressive-web-app-pwa-in-next-js-with-serwist-next-pwa-successor-94e05cb418d7)
- [Next.js 16 發佈](https://nextjs.org/blog/next-16)
- [shadcn/ui vs MUI vs Ant Design 2026 比較](https://adminlte.io/blog/shadcn-ui-vs-mui-vs-ant-design/)
- [React UI Libraries 2025 比較](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [NestJS + PostgreSQL Docker 設定教學](https://dev.to/chukwutosin_/step-by-step-guide-setting-up-a-nestjs-application-with-docker-and-postgresql-5hei)
- [NestJS + Docker Compose + Prisma](https://medium.com/@md.tarikulislamjuel/building-and-deploying-a-nestjs-application-with-docker-compose-postgresql-and-prisma-659ba65da25b)
- [Docker 開發 vs 生產最佳實踐（NestJS + NextJS monorepo）](https://forums.docker.com/t/best-practices-for-using-docker-in-development-vs-production-nestjs-nextjs-monorepo/149461)
