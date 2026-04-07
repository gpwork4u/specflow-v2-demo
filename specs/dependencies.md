# Sprint 1 依賴圖譜

## 功能清單

| 編號 | 功能 | 主要 Entity | 依賴的 Entity |
|------|------|------------|--------------|
| F-000 | 認證系統 | User (讀取) | Department (login response 包含 department) |
| F-008 | 員工/部門管理 | User, Department | 無（建立基礎資料） |
| F-001 | 打卡 | ClockRecord | User (FK), 需已認證 |

## 依賴關係

```
F-008 員工/部門管理（建立 Department + User 資料）
├── F-000 認證系統（需要 User 資料才能登入）
│   └── F-001 打卡（需要認證 + User 存在）
└── F-001 打卡（ClockRecord.user_id FK -> User）

UI Design（元件庫 + Design Tokens）
├── F-000 登入頁面
├── F-008 員工/部門管理頁面
└── F-001 打卡頁面
```

## 分析說明

### 資料模型依賴
1. **F-008 是基礎**：Department 和 User 是所有功能的根基。沒有部門和員工資料，認證和打卡都無法運作。
2. **F-000 依賴 F-008 的 Data Model**：登入需要 User 表存在、password_hash 欄位。但 F-000 的 auth module 可以獨立開發，只要共用 Prisma schema。
3. **F-001 依賴 F-000 + F-008**：打卡 API 需要 JWT 認證（F-000）、ClockRecord 需要 user_id FK（F-008）。

### 基礎設施依賴
- **Prisma Schema + Migration**：三個 feature 共用同一份 schema，需要在 Wave 0 統一定義。
- **Docker Compose**：PostgreSQL + NestJS 環境需先建立。
- **NestJS 專案骨架**：app.module、prisma.module、common 模組需先建立。

### 可並行的部分
- F-008 和 F-000 的 **後端 module 可以並行開發**，因為它們操作不同的 controller/service，只要共用同一份 Prisma schema。
- **UI Design** 可以與後端完全並行，不需等待 API 完成。
- **QA** 可以在 Wave 0 開始撰寫 test script（基於 spec 的 scenarios）。

## 拓撲排序

### Wave 0（先行，可同時啟動）

| 任務 | 負責 | 說明 |
|------|------|------|
| 專案骨架 + Prisma Schema | Engineer | 建立 NestJS 專案結構、Prisma schema（User, Department, ClockRecord）、Docker Compose、初始 migration |
| F-008: 員工/部門管理 | Engineer | Department CRUD + Employee CRUD（含 seed data） |
| F-000: 認證系統 | Engineer | Auth module（login, logout, refresh, me, change password） |
| UI Design: Sprint 1 元件 | UI Designer | Design tokens、共用元件、各頁面設計 |
| QA: 撰寫測試腳本 | QA Engineer | 根據 spec scenarios 撰寫 E2E test（可先寫，API ready 後執行） |

**說明**：F-008 和 F-000 可以由同一位或不同 engineer 並行開發。兩者共用 Prisma schema，但操作不同的 module。建議先由一人建立專案骨架（含完整 Prisma schema），然後分頭開發。

### Wave 1（Wave 0 的 F-008 + F-000 完成後）

| 任務 | 負責 | 說明 |
|------|------|------|
| F-001: 打卡功能 | Engineer | Clock module（clock in/out, today, records）—— 需要 User 資料存在 + JWT auth 可用 |

**說明**：F-001 必須等 F-000（認證）和 F-008（員工資料）的後端完成後才能進行整合測試。但 F-001 的 module 程式碼可以在 Wave 0 同步撰寫，只是無法完整測試。

## 並行策略圖

```
時間軸 ──────────────────────────────────────────────>

Wave 0:
  [UI Designer] ████████████████████ UI Design（元件 + 頁面）
  [Engineer A]  ██████ 專案骨架 + Schema ████████████ F-008 員工/部門管理
  [Engineer B]  ██████ （等 schema）     ████████████ F-000 認證系統
  [QA]          ████████████████████ 撰寫 E2E test scripts

Wave 1:
  [Engineer]                                         ████████ F-001 打卡
  [QA]                                               ████████ 執行 E2E tests
```

## QA 時程
- QA 與 Wave 0 同時開始撰寫 test script（基於 spec scenarios，不需要 API ready）
- Wave 0 完成後，QA 開始對 F-008 和 F-000 執行測試
- Wave 1 完成後，QA 對 F-001 執行測試，並進行 Sprint 1 整合測試
