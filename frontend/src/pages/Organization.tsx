import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Input, Popconfirm, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ApartmentOutlined, KeyOutlined, LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CarbonTrendChart } from '../components/common/CarbonTrendChart';
import { CategoryBadge } from '../components/common/CategoryBadge';
import { EmptyState } from '../components/common/EmptyState';
import { Messages } from '../constants/messages';
import { OrganizationMemberRole, ORGANIZATION_INVITE_STATUS_COLORS } from '../constants/organization';
import { useAuth } from '../hooks/useAuth';
import { requireRole } from '../router/guards';
import { useOrganizationStore } from '../stores/organizationStore';
import { OrganizationActivityRow, OrganizationMemberSummary, OrganizationMembership } from '../types/entities';
import { formatCarbon, formatDateTime, formatOrganizationInviteStatus, formatOrganizationMemberRole } from '../utils/formatters';

export function Organization() {
  const { token, user } = useAuth();
  const memberships = useOrganizationStore((state) => state.memberships);
  const summary = useOrganizationStore((state) => state.summary);
  const invites = useOrganizationStore((state) => state.invites);
  const feed = useOrganizationStore((state) => state.feed);
  const store = useOrganizationStore();
  const [month, setMonth] = useState<string | undefined>();
  const [redeemCode, setRedeemCode] = useState('');

  const activeMembership = useMemo(() => memberships.find((row) => !row.leftAt), [memberships]);
  const historyMemberships = useMemo(() => memberships.filter((row) => row.leftAt), [memberships]);
  const orgId = activeMembership?.orgId;
  const isGlobalAdmin = requireRole('admin');
  const canManage = Boolean(isGlobalAdmin || activeMembership?.role === OrganizationMemberRole.ADMIN);

  useEffect(() => {
    if (!token) return;
    void store.loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !orgId) return;
    void store.loadSummary(orgId, month);
    if (canManage) {
      void store.loadInvites(orgId);
      void store.loadFeed(orgId, month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orgId, month, canManage]);

  if (!token) {
    return <EmptyState text="登录后查看组织碳账户" />;
  }

  const memberColumns = [
    { title: '成员', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: OrganizationMemberRole) => <Tag color={role === OrganizationMemberRole.ADMIN ? 'gold' : 'default'}>{formatOrganizationMemberRole(role)}</Tag>
    },
    { title: '归属开始', dataIndex: 'joinedAt', key: 'joinedAt', render: (value: string) => formatDateTime(value) },
    { title: '归属结束', dataIndex: 'leftAt', key: 'leftAt', render: (value: string | null) => (value ? formatDateTime(value) : '在属') },
    { title: '当月计入活动', dataIndex: 'activityCount', key: 'activityCount' },
    { title: '当月归集', dataIndex: 'total', key: 'total', render: (value: number) => formatCarbon(value) },
    ...(canManage
      ? [
          {
            title: '操作',
            key: 'actions',
            render: (_: unknown, row: OrganizationMemberSummary) =>
              row.leftAt ? null : (
                <Popconfirm
                  title="移出该成员？其归属期内活动保留在组织历史"
                  onConfirm={async () => {
                    if (!orgId) return;
                    await store.removeMember(orgId, row.userId);
                    message.success(Messages.FRONTEND_ORG_MEMBER_REMOVED);
                    await store.loadSummary(orgId, month);
                  }}
                >
                  <Button size="small" danger disabled={row.userId === user?.id && row.role === OrganizationMemberRole.ADMIN && !isGlobalAdmin}>
                    移出
                  </Button>
                </Popconfirm>
              )
          }
        ]
      : [])
  ];

  const feedColumns = [
    { title: '日期', dataIndex: 'recordDate', key: 'recordDate' },
    { title: '成员', dataIndex: 'username', key: 'username' },
    { title: '分类', dataIndex: 'category', key: 'category', render: (category: OrganizationActivityRow['category']) => <CategoryBadge category={category} /> },
    { title: '子类型', dataIndex: 'subType', key: 'subType' },
    { title: '数量', key: 'amount', render: (_: unknown, row: OrganizationActivityRow) => `${row.amount} ${row.unit}` },
    { title: '碳排放', dataIndex: 'carbonValue', key: 'carbonValue', render: (value: string) => formatCarbon(value) },
    { title: '录入时间', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => formatDateTime(value) },
    { title: '备注', dataIndex: 'note', key: 'note', render: (value: string | null) => value || '-' }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>组织碳账户</Typography.Title>
        <Typography.Text type="secondary">归属期内录入的活动计入组织归集；退出后录入的活动不再计入，历史记录保留。</Typography.Text>
      </div>

      {isGlobalAdmin && (
        <Card title="创建组织(平台管理员)">
          <Form
            layout="inline"
            onFinish={async (values) => {
              await store.create(values);
              message.success(Messages.FRONTEND_ORG_CREATED);
            }}
          >
            <Form.Item name="name" rules={[{ required: true, message: '请输入组织名称' }]}>
              <Input placeholder="组织名称(唯一)" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="描述" style={{ width: 280 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建</Button>
          </Form>
        </Card>
      )}

      {!activeMembership && (
        <Card title="凭邀请码归属组织">
          <Space.Compact style={{ width: 360 }}>
            <Input placeholder="一次性邀请码,如 GREEN-DEMO-2026" value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} />
            <Button
              type="primary"
              icon={<KeyOutlined />}
              onClick={async () => {
                await store.redeem(redeemCode.trim());
                message.success(Messages.FRONTEND_ORG_REDEEMED);
                setRedeemCode('');
              }}
            >
              兑换
            </Button>
          </Space.Compact>
          <div>
            <Typography.Text type="secondary">同一邀请码仅可成功兑换一次;已归属其他组织时需先退出。</Typography.Text>
          </div>
        </Card>
      )}

      {activeMembership && orgId && (
        <>
          <Card
            title={
              <Space>
                <ApartmentOutlined />
                {activeMembership.organization?.name || `组织 #${orgId}`}
                <Tag color={activeMembership.role === OrganizationMemberRole.ADMIN ? 'gold' : 'default'}>{formatOrganizationMemberRole(activeMembership.role)}</Tag>
              </Space>
            }
            extra={
              <Popconfirm
                title="退出组织？既有活动留在组织历史,新活动不再计入"
                onConfirm={async () => {
                  await store.leave(orgId);
                  message.success(Messages.FRONTEND_ORG_LEFT);
                }}
              >
                <Button icon={<LogoutOutlined />} danger>退出组织</Button>
              </Popconfirm>
            }
          >
            <Typography.Text type="secondary">
              我的归属窗口:{formatDateTime(activeMembership.joinedAt)} ~ 至今 · {activeMembership.organization?.description || '暂无描述'}
            </Typography.Text>
          </Card>

          <Card
            title="组织月度归集"
            extra={<DatePicker picker="month" value={month ? dayjs(month) : undefined} onChange={(value) => setMonth(value ? value.format('YYYY-MM') : undefined)} allowClear />}
          >
            {summary ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}><Statistic title={`${summary.month} 归集总量`} value={formatCarbon(summary.total)} /></Col>
                  <Col xs={24} md={8}><Statistic title="计入活动数" value={summary.activityCount} /></Col>
                  <Col xs={24} md={8}><Statistic title="在属成员" value={summary.members.filter((row) => !row.leftAt).length} /></Col>
                </Row>
                <Space wrap>
                  {summary.byCategory.length
                    ? summary.byCategory.map((row) => (
                        <Space key={row.category} size={4}>
                          <CategoryBadge category={row.category} />
                          <Typography.Text>{formatCarbon(row.value)}</Typography.Text>
                        </Space>
                      ))
                    : <Typography.Text type="secondary">当月暂无窗口内活动</Typography.Text>}
                </Space>
                <CarbonTrendChart data={summary.trend.map((point) => ({ date: point.month, value: point.value }))} />
              </Space>
            ) : (
              <EmptyState text="暂无归集数据" />
            )}
          </Card>

          <Card title="成员与归属窗口">
            <Table
              rowKey="membershipId"
              size="small"
              pagination={false}
              dataSource={summary?.members || []}
              columns={memberColumns}
              locale={{ emptyText: <EmptyState text="暂无成员" /> }}
            />
          </Card>

          {canManage && (
            <>
              <Card
                title="一次性邀请码"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={async () => {
                      await store.issueInvite(orgId);
                      message.success(Messages.FRONTEND_ORG_INVITE_ISSUED);
                    }}
                  >
                    签发邀请码
                  </Button>
                }
              >
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={invites}
                  locale={{ emptyText: <EmptyState text="尚未签发邀请码" /> }}
                  columns={[
                    { title: '邀请码', dataIndex: 'code', key: 'code', render: (code: string) => <Typography.Text code>{code}</Typography.Text> },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status: keyof typeof ORGANIZATION_INVITE_STATUS_COLORS) => <Tag color={ORGANIZATION_INVITE_STATUS_COLORS[status]}>{formatOrganizationInviteStatus(status)}</Tag>
                    },
                    { title: '兑换人', dataIndex: 'redeemedBy', key: 'redeemedBy', render: (value: number | null) => value ?? '-' },
                    { title: '兑换时间', dataIndex: 'redeemedAt', key: 'redeemedAt', render: (value: string | null) => (value ? formatDateTime(value) : '-') },
                    { title: '签发时间', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => formatDateTime(value) }
                  ]}
                />
              </Card>

              <Card title="归属窗口内活动(组织管理员可见)">
                <Table
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  dataSource={feed}
                  columns={feedColumns}
                  locale={{ emptyText: <EmptyState text="窗口内暂无活动" /> }}
                />
              </Card>
            </>
          )}
        </>
      )}

      {historyMemberships.length > 0 && (
        <Card title="历史归属">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={historyMemberships}
            columns={[
              { title: '组织', key: 'org', render: (_: unknown, row: OrganizationMembership) => row.organization?.name || `组织 #${row.orgId}` },
              { title: '角色', dataIndex: 'role', key: 'role', render: (role: OrganizationMemberRole) => formatOrganizationMemberRole(role) },
              { title: '归属开始', dataIndex: 'joinedAt', key: 'joinedAt', render: (value: string) => formatDateTime(value) },
              { title: '归属结束', dataIndex: 'leftAt', key: 'leftAt', render: (value: string | null) => (value ? formatDateTime(value) : '-') }
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
