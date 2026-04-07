# HR 工時系統 - 專案總覽

## Status: active
## Created: 2026-04-07

## 專案描述

HR 工時系統是一套全端 + PWA 行動版的企業出勤管理平台，提供員工打卡、請假、加班申請等功能，並支援主管審核與 HR 管理。系統目標是取代傳統紙本或 Excel 管理方式，提供即時、透明的出勤管理體驗。

## 目標使用者

| 角色 | 說明 | 主要功能 |
|------|------|---------|
| 員工 (Employee) | 一般使用者 | 打卡、請假申請、加班申請、補打卡、查看個人紀錄 |
| 主管 (Manager) | 部門主管 | 審核請假/加班/補打卡、查看團隊出席、團隊行事曆 |
| HR 管理員 (Admin) | 人資部門 | 員工/部門管理、假別額度設定、全公司報表、系統設定 |

## 權限矩陣

| 功能 | 員工 | 主管 | HR 管理員 |
|------|------|------|----------|
| 打卡（上班/下班） | O | O | O |
| 請假申請 | O | O | O |
| 審核請假 | X | O（僅直屬部屬） | O（全公司） |
| 行事曆 - 個人 | O | O | O |
| 行事曆 - 團隊 | X | O | O |
| 出席報表 - 個人 | O | O | O |
| 出席報表 - 團隊 | X | O | O |
| 出席報表 - 全公司 | X | X | O |
| 加班申請 | O | O | O |
| 審核加班 | X | O（僅直屬部屬） | O（全公司） |
| 補打卡申請 | O | O | O |
| 審核補打卡 | X | O（僅直屬部屬） | O（全公司） |
| 員工/部門管理 | X | X | O |
| 假別額度管理 | X | X | O |
| 通知接收 | O | O | O |

## 技術架構

### 前端
- **框架**: Next.js (React)
- **PWA**: 支援行動裝置安裝、離線基本功能
- **技術偏好**: TypeScript

### 後端
- **框架**: NestJS（獨立 API 服務）
- **語言**: TypeScript
- **API 風格**: RESTful
- **認證**: JWT Token（Bearer Token）

### 資料庫
- **主資料庫**: PostgreSQL
- **ORM**: Prisma（Tech Lead survey 後確認）

### 部署
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

### API 基礎路徑
- `POST /api/v1/auth/*` — 認證相關
- `GET/POST /api/v1/*` — 業務 API
- 所有 API 回傳 JSON 格式
- 時間格式一律使用 ISO 8601（UTC）
- 分頁格式統一使用 `{ data: [], meta: { total, page, limit, totalPages } }`

### 通用錯誤回應格式

```json
{
  "statusCode": 400,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

### 通用 HTTP Status Codes

| Status | 用途 |
|--------|------|
| 200 | 成功（查詢、更新） |
| 201 | 成功（新建） |
| 204 | 成功（刪除，無內容） |
| 400 | 請求參數錯誤 |
| 401 | 未認證 |
| 403 | 權限不足 |
| 404 | 資源不存在 |
| 409 | 衝突（重複資料） |
| 422 | 業務邏輯錯誤 |
| 500 | 伺服器錯誤 |

## 資料模型概述

### 主要 Entities

```
User (使用者/員工)
├── id: UUID (PK)
├── employee_id: VARCHAR(20) UNIQUE -- 員工編號
├── email: VARCHAR(255) UNIQUE
├── password_hash: VARCHAR(255)
├── name: VARCHAR(100)
├── role: ENUM(employee, manager, admin)
├── department_id: UUID (FK -> Department)
├── manager_id: UUID (FK -> User, nullable) -- 直屬主管
├── hire_date: DATE
├── status: ENUM(active, inactive, suspended)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

Department (部門)
├── id: UUID (PK)
├── name: VARCHAR(100) UNIQUE
├── code: VARCHAR(20) UNIQUE -- 部門代碼
├── manager_id: UUID (FK -> User, nullable) -- 部門主管
├── parent_id: UUID (FK -> Department, nullable) -- 上級部門
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

ClockRecord (打卡紀錄)
├── id: UUID (PK)
├── user_id: UUID (FK -> User)
├── clock_in: TIMESTAMP -- 上班打卡時間
├── clock_out: TIMESTAMP (nullable) -- 下班打卡時間
├── date: DATE -- 打卡日期
├── status: ENUM(normal, late, early_leave, absent, amended)
├── note: TEXT (nullable)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

LeaveRequest (請假申請)
├── id: UUID (PK)
├── user_id: UUID (FK -> User)
├── leave_type: ENUM(personal, sick, annual, marriage, bereavement, maternity, paternity, official)
├── start_date: DATE
├── end_date: DATE
├── start_half: ENUM(full, morning, afternoon) -- 半天假支援
├── end_half: ENUM(full, morning, afternoon)
├── hours: DECIMAL(5,1) -- 實際請假時數
├── reason: TEXT
├── status: ENUM(pending, approved, rejected, cancelled)
├── reviewer_id: UUID (FK -> User, nullable)
├── reviewed_at: TIMESTAMP (nullable)
├── review_comment: TEXT (nullable)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

LeaveQuota (假別額度)
├── id: UUID (PK)
├── user_id: UUID (FK -> User)
├── leave_type: ENUM(...)
├── year: INTEGER -- 年度
├── total_hours: DECIMAL(5,1) -- 年度總時數
├── used_hours: DECIMAL(5,1) DEFAULT 0 -- 已使用時數
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

OvertimeRequest (加班申請)
├── id: UUID (PK)
├── user_id: UUID (FK -> User)
├── date: DATE
├── start_time: TIME
├── end_time: TIME
├── hours: DECIMAL(4,1) -- 加班時數
├── reason: TEXT
├── status: ENUM(pending, approved, rejected, cancelled)
├── reviewer_id: UUID (FK -> User, nullable)
├── reviewed_at: TIMESTAMP (nullable)
├── review_comment: TEXT (nullable)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

MissedClockRequest (補打卡申請)
├── id: UUID (PK)
├── user_id: UUID (FK -> User)
├── date: DATE
├── clock_type: ENUM(clock_in, clock_out)
├── requested_time: TIMESTAMP -- 補登的時間
├── reason: TEXT
├── status: ENUM(pending, approved, rejected)
├── reviewer_id: UUID (FK -> User, nullable)
├── reviewed_at: TIMESTAMP (nullable)
├── review_comment: TEXT (nullable)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

Notification (通知)
├── id: UUID (PK)
├── user_id: UUID (FK -> User) -- 接收者
├── type: ENUM(leave_approved, leave_rejected, overtime_approved, overtime_rejected, missed_clock_approved, missed_clock_rejected, reminder_clock_in, reminder_leave_expiry)
├── title: VARCHAR(200)
├── content: TEXT
├── reference_type: VARCHAR(50) -- 關聯類型（leave_request, overtime_request 等）
├── reference_id: UUID -- 關聯 ID
├── is_read: BOOLEAN DEFAULT false
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP
```

### Entity 關係

```
Department 1──N User（一個部門有多個員工）
User 1──1 User（manager_id 自參照，直屬主管）
User 1──N ClockRecord
User 1──N LeaveRequest
User 1──N LeaveQuota
User 1──N OvertimeRequest
User 1──N MissedClockRequest
User 1──N Notification
```

## Sprint 規劃

### Sprint 1: 基礎建設（預估 2 週）
- **F-000**: 認證系統（登入/登出/JWT）
- **F-008**: 員工/部門管理
- **F-001**: 打卡（上班/下班）

### Sprint 2: 請假流程（預估 2 週）
- **F-002**: 請假申請
- **F-003**: 主管審核請假
- **F-009**: 假別額度管理

### Sprint 3: 可視化（預估 2 週）
- **F-004**: 行事曆檢視
- **F-005**: 出席報表/統計

### Sprint 4: 進階功能（預估 2 週）
- **F-006**: 加班申請
- **F-010**: 補打卡申請
- **F-007**: 通知功能

## 非功能需求

1. **效能**: API 回應時間 < 500ms（P95）
2. **安全**: 密碼 bcrypt 加密、JWT 有效期 24 小時、Refresh Token 7 天
3. **可用性**: PWA 支援離線查看最近打卡紀錄
4. **國際化**: 初版僅支援繁體中文
5. **時區**: 系統以 UTC 儲存，前端轉換為 Asia/Taipei (UTC+8)
