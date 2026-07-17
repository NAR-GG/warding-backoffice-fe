import { useState } from "react";
import { useList } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 리그 필터 콤보박스(검색 가능). 옵션은 GET /api/admin/leagues (distinct 문자열 배열).
// controlled: 선택값은 부모(페이지)가 소유 — 기본 LCK 은 페이지의 초기 상태로 설정한다.
// value "" = 전체(필터 해제).
export function LeagueSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (league: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { result } = useList({ resource: "leagues", pagination: { mode: "off" } });
  const leagues = (result?.data ?? []) as unknown as string[];
  const options = ["", ...leagues]; // "" = 전체

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[160px] justify-between">
          {value === "" ? "리그 전체" : value}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-0">
        <Command>
          <CommandInput placeholder="리그 검색" />
          <CommandList>
            <CommandEmpty>결과 없음</CommandEmpty>
            <CommandGroup>
              {options.map((l) => (
                <CommandItem
                  key={l || "ALL"}
                  value={l || "전체"}
                  onSelect={() => {
                    onChange(l);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === l ? "opacity-100" : "opacity-0")} />
                  {l === "" ? "리그 전체" : l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
