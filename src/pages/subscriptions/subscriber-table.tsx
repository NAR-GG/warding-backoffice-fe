import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 팀·경기 구독자 공용 화면. 두 API 응답 모양이 같아(알림 토글 3종) 한 컴포넌트로 쓴다.
export type ToggleSubscriber = {
  id: number; // memberId
  nickname: string;
  email: string | null;
  subscribedAt: string;
  setStartEnabled: boolean;
  setEndEnabled: boolean;
  liveEventEnabled: boolean;
};

const ToggleBadge = ({ on, label }: { on: boolean; label: string }) => (
  <span
    className={`rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${
      on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground line-through"
    }`}
  >
    {label}
  </span>
);

// 검색 대상 필드. 백엔드에 field=...&q=... 로 전달.
const SEARCH_FIELDS = [
  { value: "nickname", label: "닉네임" },
  { value: "memberId", label: "회원 ID" },
  { value: "email", label: "이메일" },
] as const;
type SearchField = (typeof SEARCH_FIELDS)[number]["value"];

type Props = {
  // 예: `subscriptions/teams/3/subscribers`
  resource: string;
  // 제목에 들어갈 대상 이름(팀명 / 대진명).
  title: string;
  backTo: string;
};

export const SubscriberTable = ({ resource, title, backTo }: Props) => {
  const [searchField, setSearchField] = useState<SearchField>("nickname");
  const [query, setQuery] = useState("");

  const { result, tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<ToggleSubscriber>({ resource, pagination: { pageSize: 20 } });

  const applyFilters = (field: SearchField, q: string) =>
    setFilters(
      q
        ? [
            { field: "field", operator: "eq", value: field },
            { field: "q", operator: "contains", value: q },
          ]
        : [],
      "replace"
    );

  const columns: Column<ToggleSubscriber>[] = [
    { key: "id", title: "회원 ID" },
    { key: "nickname", title: "닉네임" },
    { key: "email", title: "이메일", render: (row) => row.email ?? "-" },
    {
      key: "toggles",
      title: "알림 설정",
      render: (row) => (
        <span className="inline-flex gap-1">
          <ToggleBadge on={row.setStartEnabled} label="세트 시작" />
          <ToggleBadge on={row.setEndEnabled} label="세트 종료" />
          <ToggleBadge on={row.liveEventEnabled} label="라이브" />
        </span>
      ),
    },
    {
      key: "subscribedAt",
      title: "구독일",
      render: (row) =>
        row.subscribedAt ? new Date(row.subscribedAt).toLocaleString("ko-KR") : "-",
    },
  ];

  const total = result?.total ?? 0;

  return (
    <section className="space-y-4">
      <Link
        to={backTo}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        구독 목록으로
      </Link>
      <h1 className="text-2xl font-semibold">
        {title} 구독자
        <span className="ml-2 text-base font-normal text-muted-foreground">{total}명</span>
      </h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => {
          setQuery(q);
          applyFilters(searchField, q);
        }}
        searchPlaceholder={`${SEARCH_FIELDS.find((f) => f.value === searchField)?.label} 검색`}
        filterSlot={
          <Select
            value={searchField}
            onValueChange={(v) => {
              const field = v as SearchField;
              setSearchField(field);
              applyFilters(field, query);
            }}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </section>
  );
};
