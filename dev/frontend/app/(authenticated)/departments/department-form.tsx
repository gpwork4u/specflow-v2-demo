"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { departmentFormSchema, type DepartmentFormValues } from "@/lib/schemas";

interface DepartmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultValues?: Partial<DepartmentFormValues>;
  /** Current department ID (when editing, to exclude from parent options) */
  currentId?: string;
  departments: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  onSubmit: (data: DepartmentFormValues) => Promise<void>;
}

export function DepartmentForm({
  open,
  onOpenChange,
  mode,
  defaultValues,
  currentId,
  departments,
  managers,
  onSubmit,
}: DepartmentFormProps) {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: defaultValues || {
      name: "",
      code: "",
      manager_id: "",
      parent_id: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        defaultValues || {
          name: "",
          code: "",
          manager_id: "",
          parent_id: "",
        }
      );
    }
  }, [open, defaultValues, form]);

  const isSubmitting = form.formState.isSubmitting;

  // Filter out the current department from parent options
  const parentOptions = departments.filter((d) => d.id !== currentId);

  const handleSubmit = async (data: DepartmentFormValues) => {
    // Clean up empty optional fields
    const cleaned = {
      ...data,
      manager_id: data.manager_id || undefined,
      parent_id: data.parent_id || undefined,
    };
    try {
      await onSubmit(cleaned);
      onOpenChange(false);
    } catch {
      // Error handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "新增部門" : "編輯部門"}
          </DialogTitle>
          <DialogDescription>填寫部門基本資料</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* 部門名稱 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例：工程部" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 部門代碼 */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門代碼 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：ENG"
                      className="font-mono uppercase"
                      disabled={mode === "edit"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>僅允許英數字和連字號</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 部門主管 */}
            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門主管</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇主管（選填）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">不指定</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>選填，僅限 manager 角色</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 上級部門 */}
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>上級部門</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇上級部門（選填）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">無上級部門</SelectItem>
                      {parentOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>選填，部門最多 3 層</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "create" ? "新增" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
