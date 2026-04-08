# 員工列表頁

## 對應 Feature

#7 F-008: 員工/部門管理

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [≡] 員工管理              [Avatar ▼]     │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│   Dashboard│ ┌── PageHeader ──────────────────┐  │
│   打卡     │ │ 員工管理           [+ 新增員工] │  │
│   打卡紀錄 │ │ 管理公司員工帳號與資料          │  │
│   ─────    │ └────────────────────────────────┘  │
│ > 員工管理 │                                     │
│   部門管理 │ ┌── SearchFilter ────────────────┐  │
│            │ │ [🔍 搜尋...] [部門▼] [角色▼]   │  │
│            │ │              [狀態▼] [重置]     │  │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── DataTable ───────────────────┐  │
│            │ │ 編號  姓名  Email  部門  角色   │  │
│            │ │ 狀態  到職日  操作              │  │
│            │ │ ──────────────────────────────  │  │
│            │ │ EMP001 王小明 ...  工程部 員工  │  │
│            │ │ EMP002 李大華 ...  工程部 主管  │  │
│            │ │ ...                             │  │
│            │ ├────────────────────────────────┤  │
│            │ │ 共 50 筆  [20筆/頁▼] [< 1/3 >] │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/employees` |
| 認證 | 需要（role: admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[Dashboard, 員工管理]` |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 + 新增按鈕 |
| SearchFilter | `components/search-filter` | 搜尋 + 篩選 |
| DataTable | `components/data-table` | 員工表格 |
| StatusBadge | `components/status-badge` | 角色/狀態標籤 |
| ConfirmDialog | `components/confirm-dialog` | 停用確認 |
| EmptyState | `components/empty-state` | 無資料狀態 |
| Toast | shadcn/ui | 操作回饋 |

## 表格欄位

| 欄位 | Header | 寬度 | 可排序 | 說明 |
|------|--------|------|--------|------|
| employee_id | 員工編號 | 100px | - | `font-mono text-sm` |
| name | 姓名 | auto | 可排序 | 預設排序欄位 |
| email | Email | auto | - | `text-muted-foreground` |
| department.name | 部門 | 120px | - | 可篩選 |
| role | 角色 | 80px | - | StatusBadge(type="role") |
| status | 狀態 | 80px | - | StatusBadge(type="account") |
| hire_date | 到職日 | 120px | 可排序 | yyyy-MM-dd 格式 |
| actions | 操作 | 60px | - | DropdownMenu |

## 篩選器

| 篩選 | Key | 選項 |
|------|-----|------|
| 部門 | `department_id` | 動態載入部門列表 |
| 角色 | `role` | employee / manager / admin |
| 狀態 | `status` | active / inactive / suspended |

## 互動行為

### 搜尋

- 模糊搜尋姓名、員工編號、Email
- Debounce 300ms，避免頻繁 API 呼叫
- 搜尋時呼叫 `GET /api/v1/employees?search=...`

### 新增員工

1. 點擊「新增員工」按鈕
2. 開啟員工表單 Dialog（見 `employee-form.md`）
3. 送出成功後刷新列表 + Toast "新增成功"

### 行操作（DropdownMenu）

| 操作 | Icon | 說明 |
|------|------|------|
| 編輯 | `Pencil` | 開啟員工表單 Dialog（預填資料） |
| 重設密碼 | `KeyRound` | ConfirmDialog -> 重設密碼 API |
| 停用帳號 | `UserX` | ConfirmDialog(destructive) -> 更新 status |

### 分頁

- 預設每頁 20 筆
- 可選 10 / 20 / 50 筆
- Server-side 分頁（API 回傳 meta.total, meta.totalPages）

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | 完整表格，所有欄位可見 |
| 768-1023px (md) | 隱藏 email 欄位 |
| < 768px (sm) | 隱藏 email + hire_date，篩選器堆疊 |

## API 呼叫

```
GET /api/v1/employees?search={search}&department_id={dept}&role={role}&status={status}&page={page}&limit={limit}
```
