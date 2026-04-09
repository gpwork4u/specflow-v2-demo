"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "請輸入目前密碼"),
    new_password: z
      .string()
      .min(8, "密碼至少 8 個字元")
      .max(100, "密碼最長 100 個字元"),
    confirm_password: z.string().min(1, "請確認新密碼"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "新密碼與確認密碼不一致",
    path: ["confirm_password"],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: "新密碼不可與目前密碼相同",
    path: ["new_password"],
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface PasswordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PasswordFormValues) => Promise<void>;
}

export function PasswordForm({ open, onOpenChange, onSubmit }: PasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const handleSubmit = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch {
      // API errors handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>變更密碼</DialogTitle>
          <DialogDescription>請輸入目前密碼和新密碼</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <PasswordField
              control={form.control}
              name="current_password"
              label="目前密碼"
              placeholder="請輸入目前密碼"
            />
            <PasswordField
              control={form.control}
              name="new_password"
              label="新密碼"
              placeholder="至少 8 個字元"
            />
            <PasswordField
              control={form.control}
              name="confirm_password"
              label="確認新密碼"
              placeholder="再次輸入新密碼"
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                變更密碼
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  control,
  name,
  label,
  placeholder,
}: {
  control: any;
  name: string;
  label: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder={placeholder}
                {...field}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShow(!show)}
                tabIndex={-1}
                aria-label={show ? "隱藏密碼" : "顯示密碼"}
              >
                {show ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
