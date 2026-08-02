import { useCustom } from "@refinedev/core";
import type { SignupRow } from "./signup-chart";

/**
 * 대시보드 데이터. 백엔드는 값이 있는 **1시간 버킷만** 내려주므로(sparse)
 * 빈 시간 채우기 · 일별 합산 · 24시간 롤링 윈도 조립은 전부 여기서 한다.
 *
 * GET /api/admin/stats/series?days=N        — 가입·구독 시간 버킷
 * GET /api/admin/stats/notifications?days=N — 알림 발송량. 35만 행 집계라 느려서 따로 부른다
 *                                              (나머지 카드가 먼저 그려지도록)
 * GET /api/admin/stats/overview             — 퍼널 4단계 + 관심 리그·구독 TOP 10
 */

type HourCount = { bucket: string; count: number };
type HourSubscription = { bucket: string; player: number; team: number; match: number };

type SeriesResponse = {
  from: string;
  bucketUnit: string;
  signups: HourCount[];
  subscriptions: HourSubscription[];
};

type NotificationsResponse = {
  from: string;
  bucketUnit: string;
  notifications: HourCount[];
};

type LabelCount = { label: string; count: number };

type OverviewResponse = {
  totalMembers: number;
  onboardedMembers: number;
  subscribedMembers: number;
  ratedMembers: number;
  leagues: LabelCount[];
  teams: LabelCount[];
  players: LabelCount[];
};

export type SubsPoint = { label: string; player: number; team: number; match: number };
export type PushPoint = { label: string; count: number };
export type FunnelStep = { name: string; count: number };
export type RankRow = { name: string; count: number };

const HOUR_MS = 3_600_000;
const MAX_DAYS = 90;

const pad = (n: number) => String(n).padStart(2, "0");
// 백엔드 버킷 포맷과 동일하게 맞춘다: 2026-08-02T13:00 (서버·브라우저 모두 KST 가정)
const hourKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
const dayLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const isoDate = (d: Date) => hourKey(d).slice(0, 10);

const startOfHour = (d: Date) => {
  const copy = new Date(d);
  copy.setMinutes(0, 0, 0);
  return copy;
};
const startOfDay = (offsetDays: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const mapBy = <T>(rows: T[], value: (row: T) => number, key: (row: T) => string) => {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(key(row), value(row)));
  return map;
};
const at = (map: Map<string, number>, key: string) => map.get(key) ?? 0;

/** 현재 시각 기준 직전 24시간(정시 단위). 지금이 21시면 어제 22시 → 오늘 21시. */
const rollingHours = () => {
  const end = startOfHour(new Date());
  return Array.from({ length: 24 }, (_, i) => new Date(end.getTime() - (23 - i) * HOUR_MS));
};

const dayHours = (day: Date) =>
  Array.from({ length: 24 }, (_, h) => new Date(day.getTime() + h * HOUR_MS));

export function useDashboardStats(range: number) {
  const hourly = range === 1;
  // 일별 뷰는 직전 같은 길이 구간까지 비교하므로 2배수. 24시간 뷰는 자정을 걸치므로 3일이면 충분.
  const days = Math.min(MAX_DAYS, hourly ? 3 : range * 2);

  const series = useCustom<SeriesResponse>({
    url: "/api/admin/stats/series",
    method: "get",
    config: { query: { days } },
  });
  const notificationSeries = useCustom<NotificationsResponse>({
    url: "/api/admin/stats/notifications",
    method: "get",
    config: { query: { days } },
  });
  const overview = useCustom<OverviewResponse>({
    url: "/api/admin/stats/overview",
    method: "get",
  });

  const signupMap = mapBy(series.result?.data?.signups ?? [], (r) => r.count, (r) => r.bucket);
  const pushMap = mapBy(notificationSeries.result?.data?.notifications ?? [], (r) => r.count, (r) => r.bucket);
  const subscriptions = series.result?.data?.subscriptions ?? [];
  const subPlayerMap = mapBy(subscriptions, (r) => r.player, (r) => r.bucket);
  const subTeamMap = mapBy(subscriptions, (r) => r.team, (r) => r.bucket);
  const subMatchMap = mapBy(subscriptions, (r) => r.match, (r) => r.bucket);

  const hours = rollingHours();
  const dayList = Array.from({ length: range }, (_, i) => startOfDay(-(range - 1 - i)));

  const sumDay = (day: Date, map: Map<string, number>) =>
    dayHours(day).reduce((total, hour) => total + at(map, hourKey(hour)), 0);

  const signupRows: SignupRow[] = hourly
    ? hours.map((hour) => ({
        label: `${hour.getHours()}시`,
        title: `${dayLabel(hour)} ${hour.getHours()}~${(hour.getHours() + 1) % 24}시`,
        count: at(signupMap, hourKey(hour)),
        prev: at(signupMap, hourKey(new Date(hour.getTime() - 24 * HOUR_MS))),
      }))
    : dayList.map((day) => {
        const perHour = dayHours(day).map((hour) => at(signupMap, hourKey(hour)));
        const peak = perHour.indexOf(Math.max(...perHour));
        const count = perHour.reduce((a, b) => a + b, 0);
        const prevDay = new Date(day);
        prevDay.setDate(prevDay.getDate() - range);
        return {
          label: dayLabel(day),
          title: isoDate(day),
          count,
          prev: sumDay(prevDay, signupMap),
          hint: count > 0 ? `피크 ${peak}~${peak + 1}시 · ${perHour[peak]}명` : undefined,
        };
      });

  const subs: SubsPoint[] = hourly
    ? hours.map((hour) => ({
        label: `${hour.getHours()}시`,
        player: at(subPlayerMap, hourKey(hour)),
        team: at(subTeamMap, hourKey(hour)),
        match: at(subMatchMap, hourKey(hour)),
      }))
    : dayList.map((day) => ({
        label: dayLabel(day),
        player: sumDay(day, subPlayerMap),
        team: sumDay(day, subTeamMap),
        match: sumDay(day, subMatchMap),
      }));

  const pushes: PushPoint[] = hourly
    ? hours.map((hour) => ({ label: `${hour.getHours()}시`, count: at(pushMap, hourKey(hour)) }))
    : dayList.map((day) => ({ label: dayLabel(day), count: sumDay(day, pushMap) }));

  const o = overview.result?.data;
  const funnel: FunnelStep[] = [
    { name: "가입", count: o?.totalMembers ?? 0 },
    { name: "온보딩 완료", count: o?.onboardedMembers ?? 0 },
    { name: "구독 1개 이상", count: o?.subscribedMembers ?? 0 },
    { name: "평점 작성", count: o?.ratedMembers ?? 0 },
  ];
  const toRanks = (rows?: LabelCount[]): RankRow[] =>
    (rows ?? []).map((row) => ({ name: row.label, count: row.count }));

  return {
    isLoading: series.query.isLoading || overview.query.isLoading,
    isError: series.query.isError || overview.query.isError,
    // 알림만 따로 — 느린 쿼리라 이 카드만 나중에 채워진다.
    isNotificationLoading: notificationSeries.query.isLoading,
    isNotificationError: notificationSeries.query.isError,
    hourly,
    compareLabel: hourly ? "24시간 전 같은 시간" : `직전 ${range}일`,
    signupRows,
    subs,
    pushes,
    funnel,
    totalMembers: o?.totalMembers ?? 0,
    onboardRate: o && o.totalMembers > 0 ? (o.onboardedMembers / o.totalMembers) * 100 : 0,
    leagues: toRanks(o?.leagues),
    teams: toRanks(o?.teams),
    players: toRanks(o?.players),
  };
}
