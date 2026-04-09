"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  LogIn,
  LogOut,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ClockButtonProps {
  status: "idle" | "clocked_in" | "clocked_out";
  clockInTime: string | null;
  clockOutTime: string | null;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

export function ClockButton({
  status,
  clockInTime,
  clockOutTime,
  onClockIn,
  onClockOut,
  isLoading = false,
}: ClockButtonProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buttonConfig = {
    idle: {
      label: "上班打卡",
      icon: LogIn,
      onClick: onClockIn,
      disabled: false,
      className: "bg-primary hover:bg-primary/90 shadow-primary/25",
    },
    clocked_in: {
      label: "下班打卡",
      icon: LogOut,
      onClick: onClockOut,
      disabled: false,
      className: "bg-green-600 hover:bg-green-700 shadow-green-600/25",
    },
    clocked_out: {
      label: "今日已完成",
      icon: CheckCircle2,
      onClick: () => {},
      disabled: true,
      className: "bg-muted text-muted-foreground shadow-none",
    },
  };

  const config = buttonConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 即時時鐘 */}
      <div className="text-center">
        <p className="text-4xl font-bold tabular-nums tracking-tight md:text-5xl">
          {format(now, "HH:mm:ss")}
        </p>
        <p className="mt-2 text-lg text-muted-foreground">
          {format(now, "yyyy年M月d日 EEEE", { locale: zhTW })}
        </p>
      </div>

      {/* 打卡按鈕 */}
      <button
        onClick={config.onClick}
        disabled={config.disabled || isLoading}
        className={cn(
          "flex h-40 w-40 flex-col items-center justify-center rounded-full md:h-48 md:w-48",
          "text-white shadow-lg transition-all duration-200",
          "active:scale-95 disabled:opacity-60 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
          config.className
        )}
        aria-label={config.label}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="mt-2 text-lg font-semibold">處理中...</span>
          </>
        ) : (
          <>
            <Icon className="h-10 w-10" />
            <span className="mt-2 text-2xl font-bold">{config.label}</span>
          </>
        )}
      </button>

      {/* 今日狀態 */}
      <Card className="w-full max-w-xs">
        <CardContent className="p-4">
          <h3 className="mb-3 text-center text-sm font-medium text-muted-foreground">
            今日打卡狀態
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                <span>上班</span>
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  clockInTime ? "" : "text-muted-foreground"
                )}
              >
                {clockInTime
                  ? format(new Date(clockInTime), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>下班</span>
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  clockOutTime ? "" : "text-muted-foreground"
                )}
              >
                {clockOutTime
                  ? format(new Date(clockOutTime), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
