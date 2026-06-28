import { List, useTable } from "@refinedev/antd";
import { Table } from "antd";

export const PlayerList = () => {
  // 기본 정렬: 선수명 가나다/알파벳순
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });
  return (
    <List title="선수">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="ID" sorter />
        <Table.Column dataIndex="name" title="선수명" sorter defaultSortOrder="ascend" />
        <Table.Column dataIndex="realName" title="실명" />
        <Table.Column dataIndex="role" title="포지션" />
        <Table.Column dataIndex="age" title="나이" sorter />
      </Table>
    </List>
  );
};
