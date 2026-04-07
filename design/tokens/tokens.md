# Design Tokens 總覽

本文件彙整 HR 工時管理系統的所有 design tokens，供 engineer 快速查閱。

## 技術基礎

- **UI 元件庫**: shadcn/ui (copy-paste 模式)
- **CSS 框架**: Tailwind CSS 4
- **色彩格式**: HSL（與 shadcn/ui 預設一致）
- **主題切換**: CSS Variables（`:root` / `.dark`）

## 檔案結構

| 檔案 | 內容 |
|------|------|
| `colors.css` | 原始色票 + 語意色票 + 狀態色票 |
| `typography.css` | 字型、字級、字重、行高 |
| `spacing.css` | 間距、Layout 尺寸、圓角、陰影、z-index、動畫 |

## 色彩系統

### 語意色（Semantic Colors）

元件中使用 Tailwind utility 引用，例如 `bg-primary`、`text-destructive`。

| Token | 用途 | Light | Tailwind Class |
|-------|------|-------|---------------|
| `--primary` | 主要操作 | Blue-600 | `bg-primary text-primary-foreground` |
| `--secondary` | 次要操作 | Neutral-100 | `bg-secondary text-secondary-foreground` |
| `--destructive` | 破壞性操作 | Red-500 | `bg-destructive text-destructive-foreground` |
| `--success` | 成功狀態 | Green-500 | 自訂 `bg-[hsl(var(--success))]` |
| `--warning` | 警告狀態 | Amber-500 | 自訂 `bg-[hsl(var(--warning))]` |
| `--muted` | 低調背景 | Neutral-100 | `bg-muted text-muted-foreground` |
| `--accent` | 強調 | Neutral-100 | `bg-accent text-accent-foreground` |

### 出勤狀態色

| 狀態 | Token | 顏色 | 說明 |
|------|-------|------|------|
| 正常 | `--status-normal` | Green | 準時上下班 |
| 遲到 | `--status-late` | Amber | clock_in > 09:00 |
| 早退 | `--status-early-leave` | Deep Amber | clock_out < 18:00 |
| 缺席 | `--status-absent` | Red | 當日無打卡紀錄 |
| 已補打卡 | `--status-amended` | Blue | 補打卡核准 |

### 帳號狀態色

| 狀態 | Token | 顏色 |
|------|-------|------|
| 啟用 | `--status-active` | Green |
| 停用 | `--status-inactive` | Gray |
| 凍結 | `--status-suspended` | Red |

### 角色標籤色

| 角色 | Token | 顏色 |
|------|-------|------|
| Admin | `--role-admin` | Purple |
| 主管 | `--role-manager` | Blue |
| 員工 | `--role-employee` | Gray |

## 字型系統

### Font Family

| Token | 值 | 用途 |
|-------|---|------|
| `--font-sans` | Inter, system-ui, Noto Sans TC | 一般文字 |
| `--font-mono` | JetBrains Mono, monospace | 員工編號、代碼 |

### Type Scale

| 名稱 | Size | Line Height | Weight | 用途 | Tailwind |
|------|------|-------------|--------|------|----------|
| Display | 36px | 40px | Bold | Dashboard 數字 | `text-4xl font-bold` |
| H1 | 30px | 36px | Bold | 頁面標題 | `text-3xl font-bold` |
| H2 | 24px | 32px | Semibold | 區塊標題 | `text-2xl font-semibold` |
| H3 | 20px | 28px | Semibold | 卡片標題 | `text-xl font-semibold` |
| H4 | 18px | 28px | Semibold | 小區塊標題 | `text-lg font-semibold` |
| Body | 16px | 24px | Normal | 內文 | `text-base` |
| Small | 14px | 20px | Normal | 表格、輔助文字 | `text-sm` |
| Caption | 12px | 16px | Normal | Badge、標籤 | `text-xs` |

## 間距系統

基於 4px grid，使用 Tailwind spacing utility（`p-4` = 16px）。

### 常用間距

| Tailwind | 值 | 用途 |
|----------|---|------|
| `gap-1` / `p-1` | 4px | 極小間距（icon 與文字） |
| `gap-2` / `p-2` | 8px | 緊湊間距（Badge 內距） |
| `gap-3` / `p-3` | 12px | 小間距（表格 cell） |
| `gap-4` / `p-4` | 16px | 標準間距（Card 內距） |
| `gap-6` / `p-6` | 24px | 中間距（區塊間距） |
| `gap-8` / `p-8` | 32px | 大間距（頁面區塊） |

### Layout 尺寸

| Token | 值 | 說明 |
|-------|---|------|
| `--sidebar-width` | 256px | Sidebar 展開寬度 |
| `--sidebar-width-collapsed` | 64px | Sidebar 收合寬度 |
| `--header-height` | 64px | Header 高度 |
| `--content-max-width` | 1280px | 內容區最大寬度 |
| `--content-padding` | 24px | 內容區內距（桌面） |
| `--content-padding-mobile` | 16px | 內容區內距（手機） |

## 圓角

shadcn/ui 使用 `--radius` 作為基準（0.5rem = 8px），其他圓角依此推導。

| Tailwind | 值 | 用途 |
|----------|---|------|
| `rounded-sm` | 4px | Badge、小元件 |
| `rounded-md` | 6px | Input、Select |
| `rounded-lg` | 8px | Card、Dialog |
| `rounded-xl` | 12px | 大卡片 |
| `rounded-full` | 9999px | Avatar、圓形按鈕 |

## 陰影

| Tailwind | 用途 |
|----------|------|
| `shadow-sm` | Card hover 前 |
| `shadow` | Card 預設 |
| `shadow-md` | Dropdown、Popover |
| `shadow-lg` | Modal、Dialog |

## 響應式斷點

| Tailwind Prefix | 寬度 | 裝置 |
|----------------|------|------|
| `sm:` | >= 640px | 手機橫向 |
| `md:` | >= 768px | 平板 |
| `lg:` | >= 1024px | 小筆電 |
| `xl:` | >= 1280px | 桌面 |
| `2xl:` | >= 1536px | 大桌面 |

## Z-Index

| Token | 值 | 用途 |
|-------|---|------|
| `--z-fixed` | 30 | 固定 Header |
| `--z-sticky` | 40 | Sticky 元素 |
| `--z-dropdown` | 50 | 下拉選單 |
| `--z-overlay` | 60 | Overlay 遮罩 |
| `--z-modal` | 70 | Modal / Dialog |
| `--z-popover` | 80 | Popover / Tooltip |
| `--z-toast` | 90 | Toast 通知 |

## 動畫

| Token | 值 | 用途 |
|-------|---|------|
| `--duration-fast` | 150ms | Hover 效果 |
| `--duration-normal` | 200ms | 一般過渡 |
| `--duration-slow` | 300ms | 展開/收合 |
