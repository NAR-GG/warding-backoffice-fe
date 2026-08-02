import { useParams, useSearchParams } from "react-router";
import { SubscriberTable } from "./subscriber-table";

// 특정 경기를 예약 구독한 회원 목록. 알림 토글 3종 상태 포함.
export const MatchSubscriptionDetail = () => {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const matchName = searchParams.get("name");

  return (
    <SubscriberTable
      resource={`subscriptions/matches/${matchId}/subscribers`}
      title={matchName ?? `경기 ${matchId}`}
      backTo="/subscriptions/matches"
    />
  );
};
