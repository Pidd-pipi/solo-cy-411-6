export enum OrganizationInviteStatus {
  UNUSED = 'unused',
  REDEEMED = 'redeemed',
  REVOKED = 'revoked'
}

export enum OrganizationMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

export const ORGANIZATION_INVITE_STATUS_LABELS: Record<OrganizationInviteStatus, string> = {
  [OrganizationInviteStatus.UNUSED]: '未使用',
  [OrganizationInviteStatus.REDEEMED]: '已兑换',
  [OrganizationInviteStatus.REVOKED]: '已作废'
};

export const ORGANIZATION_INVITE_STATUS_COLORS: Record<OrganizationInviteStatus, string> = {
  [OrganizationInviteStatus.UNUSED]: 'processing',
  [OrganizationInviteStatus.REDEEMED]: 'success',
  [OrganizationInviteStatus.REVOKED]: 'default'
};

export const ORGANIZATION_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  [OrganizationMemberRole.ADMIN]: '组织管理员',
  [OrganizationMemberRole.MEMBER]: '成员'
};
