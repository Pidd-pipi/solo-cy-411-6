import dayjs from 'dayjs';
import { ActivityCategory, ACTIVITY_CATEGORY_LABELS } from '../constants/activity';
import { GoalStatus, GOAL_STATUS_LABELS } from '../constants/goal';
import { OrganizationInviteStatus, OrganizationMemberRole, ORGANIZATION_INVITE_STATUS_LABELS, ORGANIZATION_MEMBER_ROLE_LABELS } from '../constants/organization';

export function formatDate(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '-';
}

export function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

export function formatCarbon(value: number | string | undefined) {
  return `${Number(value || 0).toFixed(2)} kg CO2e`;
}

export function formatGoalStatus(status: GoalStatus) {
  return GOAL_STATUS_LABELS[status] || status;
}

export function formatActivityCategory(category: ActivityCategory) {
  return ACTIVITY_CATEGORY_LABELS[category] || category;
}

export function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

export function formatOrganizationInviteStatus(status: OrganizationInviteStatus) {
  return ORGANIZATION_INVITE_STATUS_LABELS[status] || status;
}

export function formatOrganizationMemberRole(role: OrganizationMemberRole) {
  return ORGANIZATION_MEMBER_ROLE_LABELS[role] || role;
}

