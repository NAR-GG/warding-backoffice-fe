import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { API_URL } from "@/providers/constants";

// DB의 선수·팀 이미지는 상대경로(/images/players/…) — 백엔드가 서빙하므로 API 호스트를 붙인다.
export function resolveImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/** 목록·상세의 선수/팀 썸네일. 이미지 없으면 이름 첫 글자로 대체. */
export function EntityAvatar({
  src,
  name,
  className,
  square,
}: {
  src: string | null;
  name: string;
  className?: string;
  // 팀 로고처럼 원형이 어색한 경우.
  square?: boolean;
}) {
  const shape = square ? "rounded-md" : "";
  return (
    <Avatar className={cn("size-8", shape, className)}>
      <AvatarImage src={resolveImageUrl(src) ?? undefined} alt={name} />
      <AvatarFallback className={shape}>{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}
