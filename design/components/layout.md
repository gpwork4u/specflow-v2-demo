# AppLayout

## 用途

應用程式的主要佈局框架，包含 Sidebar 導航、Header 頂部欄和主內容區。所有需要認證的頁面都使用此 Layout。

## 結構

```
┌──────────────────────────────────────────────────┐
│ Header (h: 64px, sticky top)                     │
│ [Hamburger] [Breadcrumb]        [User] [Logout]  │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│ (w: 256px) │ (max-w: 1280px, mx-auto)           │
│            │                                     │
│ [Logo]     │ ┌───────────────────────────────┐   │
│ [Nav 1]    │ │ Page Header                   │   │
│ [Nav 2]    │ │ h1 + description + actions    │   │
│ [Nav 3]    │ ├───────────────────────────────┤   │
│ [Nav 4]    │ │ Page Content                  │   │
│            │ │ (p: 24px)                     │   │
│ ────────── │ │                               │   │
│ [Settings] │ │                               │   │
│ [User]     │ └───────────────────────────────┘   │
└────────────┴─────────────────────────────────────┘
```

## 子元件

### 1. Sidebar

基於 shadcn/ui 的 `Sidebar` 元件。

**Props:**

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| role | `'employee' \| 'manager' \| 'admin'` | - | 根據角色顯示不同選單 |

**導航項目（依角色）:**

| 選單項目 | Icon | 路由 | employee | manager | admin |
|---------|------|------|----------|---------|-------|
| Dashboard | `LayoutDashboard` | `/` | v | v | v |
| 打卡 | `Clock` | `/clock` | v | v | v |
| 打卡紀錄 | `CalendarDays` | `/clock/records` | v | v | v |
| 員工管理 | `Users` | `/employees` | - | - | v |
| 部門管理 | `Building2` | `/departments` | - | - | v |

**底部項目（所有角色）:**

| 選單項目 | Icon | 動作 |
|---------|------|------|
| 變更密碼 | `KeyRound` | 開啟 PasswordForm Modal |
| 登出 | `LogOut` | 呼叫 logout API |

**範例程式碼:**

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Users,
  Building2,
  KeyRound,
  LogOut,
} from "lucide-react";

// 導航設定
const navItems = {
  main: [
    { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ["employee", "manager", "admin"] },
    { title: "打卡", icon: Clock, href: "/clock", roles: ["employee", "manager", "admin"] },
    { title: "打卡紀錄", icon: CalendarDays, href: "/clock/records", roles: ["employee", "manager", "admin"] },
  ],
  admin: [
    { title: "員工管理", icon: Users, href: "/employees", roles: ["admin"] },
    { title: "部門管理", icon: Building2, href: "/departments", roles: ["admin"] },
  ],
};

function AppSidebar({ role }: { role: string }) {
  const filteredMain = navItems.main.filter((item) => item.roles.includes(role));
  const filteredAdmin = navItems.admin.filter((item) => item.roles.includes(role));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">HR 工時系統</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主選單</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <a href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdmin.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <a href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onChangePassword}>
              <KeyRound className="h-4 w-4" />
              <span>變更密碼</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              <span>登出</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

### 2. Header

**Props:**

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| user | `{ name: string; role: string; department: string }` | - | 當前登入使用者 |
| breadcrumbs | `{ label: string; href?: string }[]` | - | 麵包屑導航 |

**範例程式碼:**

```tsx
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyRound, LogOut } from "lucide-react";

function AppHeader({ user, breadcrumbs }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* User Menu */}
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left text-sm md:block">
                <p className="font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.department}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {user.name}
              <span className="block text-xs font-normal text-muted-foreground">
                {user.role === "admin" ? "管理員" : user.role === "manager" ? "主管" : "員工"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onChangePassword}>
              <KeyRound className="mr-2 h-4 w-4" />
              變更密碼
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              登出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

### 3. AppLayout（組合）

```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

function AppLayout({ children, user, breadcrumbs }) {
  return (
    <SidebarProvider>
      <AppSidebar role={user.role} />
      <SidebarInset>
        <AppHeader user={user} breadcrumbs={breadcrumbs} />
        <main className="flex-1 p-6 md:p-6 p-4">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### 4. PageHeader

頁面標題區，統一風格。

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

// 使用範例
<PageHeader
  title="員工管理"
  description="管理公司員工帳號與資料"
  actions={
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      新增員工
    </Button>
  }
/>
```

## 響應式行為

| 斷點 | Sidebar | Header | Content |
|------|---------|--------|---------|
| >= 1024px (lg) | 固定展開 256px | 顯示 breadcrumb + user | padding 24px |
| 768-1023px (md) | 可收合，預設收合 | 顯示 hamburger + user | padding 24px |
| < 768px (sm) | 隱藏，hamburger 開啟 overlay | 簡化（僅 avatar） | padding 16px |

## Accessibility

- Sidebar 使用 `nav` + `role="navigation"` + `aria-label="主選單"`
- 當前頁面的 nav item 標記 `aria-current="page"`
- SidebarTrigger 有 `aria-label="切換側邊欄"`
- 手機版 sidebar 為 overlay modal，按 Escape 關閉
- 所有互動元素支援 keyboard navigation（Tab / Enter / Escape）
- Skip to content link 在 header 最前方

## 使用的 shadcn/ui 元件

- `Sidebar`（含所有子元件）
- `Breadcrumb`
- `Avatar`
- `DropdownMenu`
- `Separator`
- `Button`
