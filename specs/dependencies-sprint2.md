# Sprint 2 依賴圖譜

## 調查日期
2026-04-08

## Feature 清單

| 編號 | 功能 | 說明 |
|------|------|------|
| F-009 | 假別額度管理 | LeaveQuota CRUD、批次設定、員工查看額度 |
| F-002 | 請假申請 | LeaveRequest 建立、查詢、取消 |
| F-003 | 主管審核請假 | 待審核清單、核准/駁回、額度扣除 |

## 依賴關係

```
F-009 (假別額度管理)
├── F-002 (請假申請) ── 申請時需檢查 LeaveQuota 額度是否充足
│   └── F-003 (主管審核) ── 審核需要有 LeaveRequest 存在；核准時需更新 LeaveQuota
└── F-003 (主管審核) ── 核准時需更新 LeaveQuota.used_hours

UI Design
├── F-002 (請假申請表單、紀錄列表)
├── F-003 (待審核列表、審核操作)
└── F-009 (額度管理頁、個人額度總覽)
```

## 依賴分析

### Data Model 依賴
- **LeaveQuota model** 是基礎資料，F-002 的請假申請需要查詢額度（INSUFFICIENT_QUOTA 檢查）
- **LeaveRequest model** 被 F-003 的審核流程依賴（需要有請假單才能審核）
- F-003 核准時需要更新 LeaveQuota.used_hours（跨 F-009 和 F-002 的 model）

### API 依賴
- F-002 `POST /api/v1/leaves` 內部呼叫 LeaveQuota 檢查 → 依賴 F-009 的 LeaveQuota service
- F-003 `PUT /api/v1/leaves/:id/approve` 內部更新 LeaveQuota.used_hours → 依賴 F-009 的 LeaveQuota service
- F-003 的 `GET /api/v1/leaves/pending` 查詢 LeaveRequest → 依賴 F-002 的 LeaveRequest model

### 基礎設施依賴
- Prisma schema 需新增 LeaveRequest、LeaveQuota model（目前 schema 中尚未定義）
- Auth module（Sprint 1 已完成）：JwtAuthGuard、RolesGuard、CurrentUser decorator 可直接複用

## 拓撲排序

### Wave 0（先行 — 可並行）
- **UI Design**: Sprint 2 所有 UI 元件設計（不依賴後端實作）
- **F-009: 假別額度管理**: 基礎資料 model + CRUD API（無其他 feature 依賴）
- **QA**: 同時開始撰寫 test scenarios 和 test script 框架

### Wave 1（Wave 0 完成後 — 可並行）
- **F-002: 請假申請**: 依賴 F-009 的 LeaveQuota service（額度檢查）
- **F-003: 主管審核請假**: 依賴 F-009 的 LeaveQuota service（額度扣除），但 API 結構可獨立開發

> 說明：F-002 和 F-003 可在 Wave 1 並行開發。F-003 的「核准時扣除額度」邏輯依賴 F-009 的 service，
> 但 F-003 不必等 F-002 完成 — 審核 API 可以用 seed data 測試。兩者都依賴 F-009 的 LeaveQuota
> model 和 service，所以 F-009 必須先完成。

## 並行策略

```
時間軸 ──────────────────────────────────────────────>

Wave 0:  [UI Design ────────────────]
         [F-009 假別額度 ───────────]
         [QA 撰寫 test script ─────]

Wave 1:           [F-002 請假申請 ──────────]
                  [F-003 主管審核 ──────────]

整合:                        [QA E2E 測試 ──]
```

## Prisma Schema 變更（Sprint 2 新增）

Sprint 2 需要在 `dev/prisma/schema.prisma` 新增以下 model：

```prisma
model LeaveRequest {
  id            String       @id @default(uuid())
  userId        String       @map("user_id")
  leaveType     LeaveType    @map("leave_type")
  startDate     DateTime     @map("start_date") @db.Date
  endDate       DateTime     @map("end_date") @db.Date
  startHalf     HalfDay      @default(FULL) @map("start_half")
  endHalf       HalfDay      @default(FULL) @map("end_half")
  hours         Decimal      @db.Decimal(5, 1)
  reason        String       @db.Text
  status        LeaveStatus  @default(PENDING)
  reviewerId    String?      @map("reviewer_id")
  reviewedAt    DateTime?    @map("reviewed_at")
  reviewComment String?      @map("review_comment") @db.Text
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  user     User  @relation("UserLeaves", fields: [userId], references: [id])
  reviewer User? @relation("LeaveReviewer", fields: [reviewerId], references: [id])

  @@map("leave_requests")
}

model LeaveQuota {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  leaveType  LeaveType @map("leave_type")
  year       Int
  totalHours Decimal   @map("total_hours") @db.Decimal(5, 1)
  usedHours  Decimal   @default(0) @map("used_hours") @db.Decimal(5, 1)
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  user User @relation("UserQuotas", fields: [userId], references: [id])

  @@unique([userId, leaveType, year])
  @@map("leave_quotas")
}

enum LeaveType {
  PERSONAL
  SICK
  ANNUAL
  MARRIAGE
  BEREAVEMENT
  MATERNITY
  PATERNITY
  OFFICIAL
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum HalfDay {
  FULL
  MORNING
  AFTERNOON
}
```

User model 需新增 relation：
```prisma
  leaveRequests  LeaveRequest[] @relation("UserLeaves")
  reviewedLeaves LeaveRequest[] @relation("LeaveReviewer")
  leaveQuotas    LeaveQuota[]   @relation("UserQuotas")
```
