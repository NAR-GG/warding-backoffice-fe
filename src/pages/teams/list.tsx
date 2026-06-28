import { List, useTable } from "@refinedev/antd";
import { Table } from "antd";

export const TeamList = () => {
  // 기본 정렬: 팀명순
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });
  return (
    <List title="팀">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="ID" sorter />
        <Table.Column dataIndex="name" title="팀명" sorter defaultSortOrder="ascend" />
        <Table.Column dataIndex="code" title="코드" sorter />
      </Table>
    </List>
  );
};
