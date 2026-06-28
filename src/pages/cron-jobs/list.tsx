import { List } from "@refinedev/antd";
import { useList } from "@refinedev/core";
import { Table, Tag, Typography } from "antd";

// cron 작업은 페이징 없는 고정 목록. 백엔드: GET /api/admin/cron-jobs → [{ name, type, schedule, expression, description }]
export const CronJobList = () => {
  const { result, query } = useList({
    resource: "cron-jobs",
    pagination: { mode: "off" },
  });
  return (
    <List title="Cron 작업">
      <Table
        dataSource={result?.data}
        loading={query.isLoading}
        rowKey="name"
        pagination={false}
      >
        <Table.Column
          dataIndex="name"
          title="작업"
          sorter={(a: any, b: any) => a.name.localeCompare(b.name)}
        />
        <Table.Column
          dataIndex="type"
          title="유형"
          defaultSortOrder="ascend"
          sorter={(a: any, b: any) => a.type.localeCompare(b.type)}
          render={(v: string) =>
            v === "INTERVAL" ? <Tag color="blue">간격</Tag> : <Tag color="purple">시각</Tag>
          }
        />
        <Table.Column dataIndex="schedule" title="주기" />
        <Table.Column
          dataIndex="expression"
          title="원본"
          render={(v: string) => <Typography.Text code>{v}</Typography.Text>}
        />
        <Table.Column dataIndex="description" title="설명" />
      </Table>
    </List>
  );
};
