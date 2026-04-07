# 部門列表頁

## 對應 Feature

#7 F-008: 員工/部門管理

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [≡] 部門管理              [Avatar ▼]     │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│   Dashboard│ ┌── PageHeader ──────────────────┐  │
│   打卡     │ │ 部門管理           [+ 新增部門] │  │
│   打卡紀錄 │ │ 管理公司組織架構                │  │
│   ─────    │ └────────────────────────────────┘  │
│   員工管理 │                                     │
│ > 部門管理 │ ┌── SearchFilter ────────────────┐  │
│            │ │ [🔍 搜尋部門名稱或代碼...]      │  │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── Department Cards ─────────────┐ │
│            │ │ ┌──────────┐  ┌──────────┐      │ │
│            │ │ │ 工程部    │  │ 產品部    │      │ │
│            │ │ │ ENG      │  │ PROD     │      │ │
│            │ │ │ 主管:李華 │  │ 主管:張三 │      │ │
│            │ │ │ 15 人    │  │ 8 人     │      │ │
│            │ │ │ [編輯][刪]│  │ [編輯][刪]│      │ │
│            │ │ └──────────┘  └──────────┘      │ │
│            │ │                                  │ │
│            │ │ ┌──────────┐  ┌──────────┐      │ │
│            │ │ │ 前端組    │  │ 後端組    │      │ │
│            │ │ │ ENG-FE   │  │ ENG-BE   │      │ │
│            │ │ │ ↳ 工程部  │  │ ↳ 工程部  │      │ │
│            │ │ │ 6 人     │  │ 9 人     │      │ │
│            │ │ └──────────┘  └──────────┘      │ │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/departments` |
| 認證 | 需要（role: admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[Dashboard, 部門管理]` |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 + 新增按鈕 |
| SearchFilter | `components/search-filter` | 搜尋 |
| Card | shadcn/ui | 部門卡片 |
| Button | shadcn/ui | 操作按鈕 |
| ConfirmDialog | `components/confirm-dialog` | 刪除確認 |
| EmptyState | `components/empty-state` | 無資料狀態 |
| Toast | shadcn/ui | 操作回饋 |

## 部門卡片規格

```
┌──────────────────────────────┐
│ 工程部                  [⋯]  │
│ ENG                          │
│                              │
│ 👤 主管：李大華              │
│ ↳  上級：（無）              │
│ 👥 成員：15 人               │
│                              │
│ 建立於 2024-03-01            │
└──────────────────────────────┘
```

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card p-5 hover:shadow-md transition-shadow` |
| 部門名稱 | `text-lg font-semibold` |
| 部門代碼 | `text-sm font-mono text-muted-foreground` |
| 資訊行 | `text-sm text-muted-foreground`，icon + 文字 |
| 操作選單 | 右上角 DropdownMenu（編輯、刪除） |

## 範例程式碼

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
  Users,
  GitBranch,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
  manager: { id: string; name: string } | null;
  parent: { id: string; name: string } | null;
  member_count: number;
  created_at: string;
}

function DepartmentCard({
  department,
  onEdit,
  onDelete,
}: {
  department: Department;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <h3 className="text-lg font-semibold">{department.name}</h3>
          <p className="font-mono text-sm text-muted-foreground">
            {department.code}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">操作選單</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              編輯
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span>主管：{department.manager?.name || "未指定"}</span>
        </div>
        {department.parent && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>上級：{department.parent.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>成員：{department.member_count} 人</span>
        </div>
      </CardContent>
    </Card>
  );
}

// 頁面
export default function DepartmentListPage() {
  return (
    <AppLayout breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "部門管理" }]}>
      <PageHeader
        title="部門管理"
        description="管理公司組織架構"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新增部門
          </Button>
        }
      />

      <SearchFilter
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="搜尋部門名稱或代碼..."
        onReset={() => setSearch("")}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <DepartmentCard
            key={dept.id}
            department={dept}
            onEdit={() => handleEdit(dept)}
            onDelete={() => handleDelete(dept)}
          />
        ))}
      </div>

      {departments.length === 0 && (
        <EmptyState
          icon={Building2}
          title="尚無部門"
          description="建立部門來組織您的團隊結構"
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增部門
            </Button>
          }
        />
      )}
    </AppLayout>
  );
}
```

## 互動行為

### 搜尋

- 模糊搜尋部門名稱和代碼
- 即時過濾（client-side，資料量小）

### 新增部門

1. 點擊「新增部門」
2. 開啟 Dialog（見 `department-form.md`）
3. 成功後刷新列表

### 刪除部門

1. 點擊操作選單「刪除」
2. ConfirmDialog: "確定要刪除「{name}」嗎？"
3. API: `DELETE /api/v1/departments/:id`
4. 如果有員工（`HAS_MEMBERS`），Toast 提示 "部門仍有員工，無法刪除"

## 響應式行為

| 斷點 | Grid |
|------|------|
| >= 1024px (lg) | 3 欄 |
| 640-1023px (sm-lg) | 2 欄 |
| < 640px | 1 欄 |
