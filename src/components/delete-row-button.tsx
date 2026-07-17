import { useDelete } from "@refinedev/core";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// 행 삭제 버튼(확인 다이얼로그 포함). 실패(409 등)는 서버 { message } 를 그대로 토스트에 노출.
export function DeleteRowButton({
  resource,
  id,
  label,
}: {
  resource: string;
  id: number | string;
  label: string;
}) {
  // useDelete()는 { mutate, mutateAsync, mutation, ... } 반환 (Refine v5 + TanStack Query v5)
  // mutation.isPending은 TanStack Query v5에서 지원됨
  const { mutate, mutation } = useDelete();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={mutation.isPending} aria-label="삭제">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>정말 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{label}&rdquo; 을(를) 삭제합니다. 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              mutate({
                resource,
                id,
                successNotification: () => ({ message: "삭제 완료", type: "success" }),
                errorNotification: (error) => ({
                  message: "삭제 실패",
                  description: error?.message ?? "잠시 후 다시 시도해 주세요",
                  type: "error",
                }),
              })
            }
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
