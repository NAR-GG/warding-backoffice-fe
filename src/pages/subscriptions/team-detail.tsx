import { useParams, useSearchParams } from "react-router";
import { SubscriberTable } from "./subscriber-table";

// 특정 팀을 구독한 회원 목록. 알림 토글 3종 상태 포함.
export const TeamSubscriptionDetail = () => {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const teamName = searchParams.get("name");

  return (
    <SubscriberTable
      resource={`subscriptions/teams/${teamId}/subscribers`}
      title={teamName ?? `팀 #${teamId}`}
      backTo="/subscriptions/teams"
    />
  );
};
