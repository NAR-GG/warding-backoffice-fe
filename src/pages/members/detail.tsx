import type { ReactNode } from "react";
import { useOne } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EntityAvatar } from "@/components/entity-avatar";

/**
 * 가입자 상세. 목록 행 클릭으로 진입.
 * GET /api/admin/members/{id} 하나로 구독(선수·팀)·작성 리뷰까지 다 받는다.
 */
export type MemberDetail = {
  id: number;
  name: string;
  email: string | null;
  favoriteLeagueName: string | null;
  favoriteTeamName: string | null;
  deviceCount: number;
  createdAt: string;
  players: PlayerSubscription[];
  teams: TeamSubscription[];
  comments: MemberComment[];
};

type PlayerSubscription = {
  id: number;
  playerName: string;
  imageUrl: string | null;
  teamName: string | null;
  role: string | null;
  subscribedAt: string;
};

type TeamSubscription = {
  id: number;
  teamName: string;
  teamCode: string | null;
  imageUrl: string | null;
  subscribedAt: string;
};

/** 회원이 남긴 선수 리뷰(live_player_rating). 앱에서 유저가 쓰는 유일한 텍스트다. */
type MemberComment = {
  id: number;
  playerName: string | null;
  championName: string | null;
  matchTitle: string | null;
  leagueName: string | null;
  // 경기 일시(KST). 백엔드가 UTC → KST 변환해서 내린다(RatingRow 와 동일).
  matchDate: string | null;
  rating: number | null;
  comment: string | null;
  createdAt: string;
};

const DASH = "—";
const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : DASH);
const fmtDateTime = (iso: string | null) => (iso ? iso.replace("T", " ").slice(0, 16) : DASH);

export const MemberDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { result, query } = useOne<MemberDetail>({
    resource: "members",
    id: Number(id),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  if (!result) return <p className="text-sm text-destructive">가입자를 찾을 수 없습니다.</p>;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="목록으로"
          onClick={() => navigate("/members")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{result.name}</h1>
        <span className="text-sm text-muted-foreground tabular-nums">#{result.id}</span>
        <div className="ml-auto">
          <DeleteRowButton
            resource="members"
            id={result.id}
            label={result.name}
            onSuccess={() => navigate("/members")}
          />
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <Field label="이메일">{result.email ?? DASH}</Field>
          <Field label="관심 리그">{result.favoriteLeagueName ?? DASH}</Field>
          <Field label="관심 팀">{result.favoriteTeamName ?? DASH}</Field>
          <Field label="알림 기기">
            {result.deviceCount === 0 ? (
              <Badge variant="outline">없음</Badge>
            ) : (
              `${result.deviceCount}대`
            )}
          </Field>
          <Field label="가입일">{fmtDate(result.createdAt)}</Field>
        </CardContent>
      </Card>

      <SectionCard title="선수 구독" count={result.players.length} unit="명">
        <TableHeader>
          <TableRow>
            <TableHead>선수</TableHead>
            <TableHead>소속팀</TableHead>
            <TableHead>포지션</TableHead>
            <TableHead>구독일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.players.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer"
              onClick={() =>
                navigate(`/subscriptions/players/${p.id}?name=${encodeURIComponent(p.playerName)}`)
              }
            >
              <TableCell className="flex items-center gap-2 font-medium">
                <EntityAvatar src={p.imageUrl} name={p.playerName} className="size-7" />
                {p.playerName}
              </TableCell>
              <TableCell>{p.teamName ?? DASH}</TableCell>
              <TableCell>{p.role ?? DASH}</TableCell>
              <TableCell className="tabular-nums">{fmtDate(p.subscribedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </SectionCard>

      <SectionCard title="팀 구독" count={result.teams.length} unit="개">
        <TableHeader>
          <TableRow>
            <TableHead>팀</TableHead>
            <TableHead>코드</TableHead>
            <TableHead>구독일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.teams.map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer"
              onClick={() =>
                navigate(`/subscriptions/teams/${t.id}?name=${encodeURIComponent(t.teamName)}`)
              }
            >
              <TableCell className="flex items-center gap-2 font-medium">
                <EntityAvatar src={t.imageUrl} name={t.teamName} square className="size-7" />
                {t.teamName}
              </TableCell>
              <TableCell>{t.teamCode ?? DASH}</TableCell>
              <TableCell className="tabular-nums">{fmtDate(t.subscribedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </SectionCard>

      <SectionCard title="작성 리뷰" count={result.comments.length} unit="건">
        <TableHeader>
          <TableRow>
            <TableHead>선수</TableHead>
            <TableHead>경기</TableHead>
            <TableHead>별점</TableHead>
            <TableHead>한줄평</TableHead>
            <TableHead>작성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.comments.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {c.playerName ?? DASH}
                {c.championName && (
                  <span className="text-muted-foreground"> · {c.championName}</span>
                )}
              </TableCell>
              <TableCell>
                {c.matchTitle ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {c.leagueName && <Badge variant="outline">{c.leagueName}</Badge>}
                      {c.matchTitle}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {fmtDateTime(c.matchDate)}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{DASH}</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {c.rating == null ? DASH : `${c.rating} / 5`}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {/* 한줄평은 150자까지 들어온다. 2줄로 자르고 전체는 title(네이티브 툴팁)로 본다. */}
                {c.comment ? (
                  <span className="line-clamp-2" title={c.comment}>
                    {c.comment}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{DASH}</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums whitespace-nowrap">
                {fmtDateTime(c.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </SectionCard>
    </section>
  );
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * 카드 + 표 한 벌. 비면 표 없이 "없음"만.
 * 구독 100명짜리 회원(프로덕션 최대치)이 있어 카드 높이를 제한하고 안에서 스크롤한다 — 헤더는 sticky.
 * ponytail: 페이징 없음 — 서버가 섹션별 최근 100건까지만 내린다. 그 이상 필요해지면 섹션별 엔드포인트로 분리.
 */
function SectionCard({
  title,
  count,
  unit,
  children,
}: {
  title: string;
  count: number;
  // 개수 단위: 명/개/건.
  unit: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-5">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="tabular-nums">
          {count === 0 ? "없음" : `총 ${count}${unit}`}
        </CardDescription>
      </CardHeader>
      {count > 0 && (
        <CardContent className="max-h-96 overflow-y-auto px-0">
          {/* 표는 카드 좌우 여백(px-6)에 맞추고 행 높이를 키운다. 구분선은 카드 폭 전체로 흐른다. */}
          <Table className="[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card [&_td]:px-6 [&_td]:py-3 [&_th]:px-6">
            {children}
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
