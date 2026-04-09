"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface LeaveApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject";
  applicantName: string;
  isLoading?: boolean;
  onConfirm: (comment: string) => void;
}

export function LeaveApprovalModal({
  open,
  onOpenChange,
  action,
  applicantName,
  isLoading = false,
  onConfirm,
}: LeaveApprovalModalProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const isReject = action === "reject";
  const title = isReject ? "駁回請假申請" : "核准請假申請";
  const description = isReject
    ? `確定要駁回 ${applicantName} 的請假申請嗎？`
    : `確定要核准 ${applicantName} 的請假申請嗎？`;

  const handleConfirm = () => {
    if (isReject && !comment.trim()) {
      setError("駁回時必須填寫原因");
      return;
    }
    setError("");
    onConfirm(comment);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setComment("");
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="approval-comment">
            {isReject ? "駁回原因 *" : "備註（選填）"}
          </Label>
          <Textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError("");
            }}
            placeholder={isReject ? "請說明駁回原因" : "可選填核准備註"}
            className="min-h-[80px] resize-none"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            variant={isReject ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? "處理中..."
              : isReject
                ? "確認駁回"
                : "確認核准"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
