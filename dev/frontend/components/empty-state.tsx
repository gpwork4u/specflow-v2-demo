"use client";

import { FileX } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title = "沒有資料",
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {icon || <FileX className="h-12 w-12 text-muted-foreground/50" />}
      <h3 className="mt-4 text-lg font-semibold text-muted-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
      )}
    </div>
  );
}
