import { List, useTable } from "@refinedev/antd";
import { Table } from "antd";

export const MemberList = () => {
  // 기본 정렬: 최신 가입순
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: { initial: [{ field: "createdAt", order: "desc" }] },
  });
  return (
    <List title="가입자">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="ID" sorter />
        <Table.Column dataIndex="name" title="이름" />
        <Table.Column dataIndex="email" title="이메일" />
        <Table.Column dataIndex="favoriteLeagueName" title="관심 리그" />
        <Table.Column dataIndex="createdAt" title="가입일" sorter defaultSortOrder="descend" />
      </Table>
    </List>
  );
};
