# 打卡頁

## 對應 Feature

#8 F-001: 打卡（上班/下班）

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [≡] 打卡                  [Avatar ▼]     │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content (centered)             │
│            │                                     │
│   Dashboard│                                     │
│ > 打卡     │         14:32:08                    │
│   打卡紀錄 │    2026年4月7日 星期二               │
│   ─────    │                                     │
│   員工管理 │       ┌──────────┐                   │
│   部門管理 │       │          │                   │
│            │       │  下班    │                   │
│            │       │  打卡    │                   │
│            │       │          │                   │
│            │       └──────────┘                   │
│            │                                     │
│            │       ┌──────────┐                   │
│            │       │ 上班 09:00│                  │
│            │       │ 下班 --:--│                  │
│            │       └──────────┘                   │
│            │                                     │
│            │    ⚡ 可加入備註                      │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/clock` |
| 認證 | 需要（所有角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[Dashboard, 打卡]` |
| 內容對齊 | 水平垂直置中 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| ClockButton | `components/clock-button` | 打卡按鈕 + 時鐘 + 狀態 |
| Toast | shadcn/ui | 打卡結果通知 |
| Textarea | shadcn/ui | 備註輸入（選填） |

## 互動行為

### 頁面載入

1. 呼叫 `GET /api/v1/clock/today` 取得今日狀態
2. 根據回傳決定 ClockButton 的 status：
   - `clock_in == null` => `idle`
   - `clock_in != null && clock_out == null` => `clocked_in`
   - `clock_in != null && clock_out != null` => `clocked_out`

### 打卡流程

1. 使用者按下打卡按鈕
2. 按鈕進入 loading 狀態
3. 呼叫 `POST /api/v1/clock/in` 或 `POST /api/v1/clock/out`
4. 成功：
   - Toast "上班打卡成功，打卡時間 09:00:15"
   - 更新 ClockButton status
5. 失敗：
   - `ALREADY_CLOCKED_IN` => Toast "今日已打過上班卡"
   - `NOT_CLOCKED_IN` => Toast "請先打上班卡"
   - `ALREADY_CLOCKED_OUT` => Toast "今日已打過下班卡"

### 備註（可選）

- 打卡按鈕下方有一個可展開的「加入備註」連結
- 點擊展開 Textarea
- 備註會在打卡 API 中帶入 `note` 欄位

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClockButton } from "@/components/clock-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNotification } from "@/hooks/use-notification";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function ClockInPage() {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const { success, error } = useNotification();
  const queryClient = useQueryClient();

  const { data: todayStatus, isLoading } = useQuery({
    queryKey: ["clock", "today"],
    queryFn: () => api.get("/clock/today"),
  });

  const clockInMutation = useMutation({
    mutationFn: () => api.post("/clock/in", { note: note || undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clock", "today"] });
      success("上班打卡成功", `打卡時間 ${format(new Date(data.clock_in), "HH:mm:ss")}`);
      setNote("");
      setShowNote(false);
    },
    onError: (err) => {
      const messages: Record<string, string> = {
        ALREADY_CLOCKED_IN: "今日已打過上班卡",
      };
      error("打卡失敗", messages[err.code] || "請稍後再試");
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: () => api.post("/clock/out", { note: note || undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clock", "today"] });
      success("下班打卡成功", `打卡時間 ${format(new Date(data.clock_out), "HH:mm:ss")}`);
      setNote("");
      setShowNote(false);
    },
    onError: (err) => {
      const messages: Record<string, string> = {
        NOT_CLOCKED_IN: "請先打上班卡",
        ALREADY_CLOCKED_OUT: "今日已打過下班卡",
      };
      error("打卡失敗", messages[err.code] || "請稍後再試");
    },
  });

  const status = !todayStatus?.clock_in
    ? "idle"
    : !todayStatus?.clock_out
      ? "clocked_in"
      : "clocked_out";

  return (
    <AppLayout breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "打卡" }]}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <ClockButton
          status={status}
          clockInTime={todayStatus?.clock_in}
          clockOutTime={todayStatus?.clock_out}
          onClockIn={() => clockInMutation.mutate()}
          onClockOut={() => clockOutMutation.mutate()}
          isLoading={clockInMutation.isPending || clockOutMutation.isPending}
        />

        {/* 備註區 */}
        {status !== "clocked_out" && (
          <div className="mt-6 w-full max-w-xs">
            {showNote ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="輸入備註（選填，如：外出開會晚到）"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {note.length}/500
                </p>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowNote(true)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                加入備註
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 按鈕大小 | 時鐘字體 | 備註區寬度 |
|------|---------|---------|-----------|
| >= 768px | w-48 h-48 | text-5xl | max-w-xs |
| < 768px | w-40 h-40 | text-4xl | full width, px-4 |

## PWA 考量

- 打卡按鈕足夠大，單手操作友善
- 即時時鐘使用 `tabular-nums` 避免跳動
- 離線狀態下顯示提示 "目前離線，請確認網路連線後再打卡"
- 打卡動作需要網路，不支援離線打卡（時間以 server 為準）
