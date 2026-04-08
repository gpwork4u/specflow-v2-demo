# Sprint 2 驗證報告

日期: 2026-04-08

## 總結

🟢 **PASS**

- **Completeness**: ✅ PASS
- **Correctness**: ✅ PASS
- **Coherence**: ✅ PASS

---

## 1. Completeness（完整性）

### Issues 狀態

| 項目 | 狀態 | 詳情 |
|------|------|------|
| Feature issues 全部關閉 | ✅ | 3/3（#16 F-009, #17 F-002, #18 F-003） |
| Bug issues 全部關閉 | ✅ | 0/0（本 sprint 無 bug） |
| QA issue 關閉 | ✅ | #19 已關閉 |
| Design issue 關閉 | ✅ | #20 已關閉 |
| Sprint issue | ⏳ | #3 待驗證通過後關閉 |

### PRs 狀態

| PR | 標題 | 狀態 |
|----|------|------|
| [#21](https://github.com/gpwork4u/specflow-v2-demo/pull/21) | [Feature] F-009: 假別額度管理 | ✅ Merged |
| [#23](https://github.com/gpwork4u/specflow-v2-demo/pull/23) | [Feature] F-002: 請假申請 | ✅ Merged |
| [#24](https://github.com/gpwork4u/specflow-v2-demo/pull/24) | [Feature] F-003: 主管審核請假 | ✅ Merged |
| [#22](https://github.com/gpwork4u/specflow-v2-demo/pull/22) | [QA] Sprint 2 - E2E tests | ✅ Merged |
| [#25](https://github.com/gpwork4u/specflow-v2-demo/pull/25) | [Design] Sprint 2 - UI Component Dataset | ✅ Merged |

### Scenario 覆蓋率

| Feature | Spec Scenarios | E2E Tests | Browser Tests | 覆蓋 |
|---------|---------------|-----------|---------------|------|
| F-009: 假別額度管理 | 7 | 7 | 2 | ✅ |
| F-002: 請假申請 | 16 | 16 | 7 | ✅ |
| F-003: 主管審核請假 | 11 | 15 | 9 | ✅ |
| **合計** | **34** | **38** | **18** | ✅ |

---

## 2. Correctness（正確性）

### API Endpoints

| Spec Endpoint | Controller | 狀態 |
|---------------|-----------|------|
| `GET /api/v1/leave-quotas/me` | leave-quotas.controller `@Get('me')` | ✅ |
| `GET /api/v1/leave-quotas/employees/:userId` | leave-quotas.controller `@Get('employees/:userId')` | ✅ |
| `PUT /api/v1/leave-quotas/employees/:userId` | leave-quotas.controller `@Put('employees/:userId')` | ✅ |
| `POST /api/v1/leave-quotas/batch` | leave-quotas.controller `@Post('batch')` | ✅ |
| `POST /api/v1/leaves` | leaves.controller `@Post()` | ✅ |
| `GET /api/v1/leaves` | leaves.controller `@Get()` | ✅ |
| `GET /api/v1/leaves/:id` | leaves.controller `@Get(':id')` | ✅ |
| `PUT /api/v1/leaves/:id/cancel` | leaves.controller `@Put(':id/cancel')` | ✅ |
| `GET /api/v1/leaves/pending` | leave-approval.controller `@Get('pending')` | ✅ |
| `PUT /api/v1/leaves/:id/approve` | leave-approval.controller `@Put(':id/approve')` | ✅ |
| `PUT /api/v1/leaves/:id/reject` | leave-approval.controller `@Put(':id/reject')` | ✅ |

**11/11 endpoints 一致**

### Error Codes

| Error Code | Spec | 實作 | 狀態 |
|-----------|------|------|------|
| INVALID_INPUT | F-002, F-003, F-009 | leaves.service, leave-quotas.service, http-exception.filter | ✅ |
| UNAUTHORIZED | F-002, F-003 | jwt-auth.guard | ✅ |
| FORBIDDEN | F-002, F-003, F-009 | roles.guard, leaves.service, leave-approval.service | ✅ |
| NOT_FOUND | F-002, F-003, F-009 | leaves.service, leave-approval.service, leave-quotas.service | ✅ |
| DATE_CONFLICT | F-002 | leaves.service | ✅ |
| INSUFFICIENT_QUOTA | F-002 | leaves.service | ✅ |
| PAST_DATE | F-002 | leaves.service | ✅ |
| CANNOT_CANCEL | F-002 | leaves.service | ✅ |
| LEAVE_STARTED | F-002 | leaves.service | ✅ |
| QUOTA_BELOW_USED | F-009 | leave-quotas.service | ✅ |
| NOT_PENDING | F-003 | leave-approval.service | ✅ |

**11/11 error codes 一致**

### Business Rules

| 規則 | 狀態 |
|------|------|
| 請假時數計算（full/half day） | ✅ 實作於 leaves.service |
| 不可申請過去日期 (PAST_DATE) | ✅ |
| 病假可追溯 3 天 | ✅ |
| 日期衝突檢查 (DATE_CONFLICT) | ✅ |
| 額度不足檢查 (INSUFFICIENT_QUOTA) | ✅ |
| 只有 pending 可取消 | ✅ |
| 已 approved 且未開始可取消（退還額度） | ✅ |
| 已開始不可取消 (LEAVE_STARTED) | ✅ |
| Manager 只能審核直屬部屬 | ✅ |
| Admin 可審核全公司 | ✅ |
| 駁回必填 comment | ✅ |
| 核准後扣除額度 | ✅ |
| 不可審核自己的假單 | ✅ |
| 額度不可低於已使用 (QUOTA_BELOW_USED) | ✅ |
| 新員工自動產生額度 | ✅ |

---

## 3. Coherence（一致性）

| 項目 | 狀態 | 詳情 |
|------|------|------|
| 目錄結構符合 spec | ✅ | dev/src/{leaves,leave-quotas,leave-approval} 分離清楚 |
| 命名慣例一致 | ✅ | NestJS module/controller/service 命名統一 |
| Error handling 統一 | ✅ | 使用 HttpExceptionFilter 統一格式 `{code, message}` |
| 認證機制統一 | ✅ | JwtAuthGuard + RolesGuard 一致套用 |
| Unit tests 結構 | ✅ | dev/__tests__/ 下有 leave-quotas, leaves, leave-approval |
| Design 頁面覆蓋 | ✅ | 9 個請假相關頁面 + 8 個新元件 |

---

## Issues 發現

### CRITICAL（必須修復）
無

### WARNING（建議修復）
無

### SUGGESTION（可改善）
- Milestone 的 PRs 未設定 milestone 欄位（PRs 的 milestone 皆為 null），建議後續 sprint 在建立 PR 時關聯 milestone
