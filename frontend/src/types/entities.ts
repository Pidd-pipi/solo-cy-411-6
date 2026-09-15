import { ActivityCategory } from '../constants/activity';
import { GoalStatus } from '../constants/goal';
import { OrganizationInviteStatus, OrganizationMemberRole } from '../constants/organization';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  region: string;
  createdAt?: string;
  roles?: string[];
}

export interface CarbonFactor {
  id: number;
  category: ActivityCategory;
  subType: string;
  factorValue: string;
  unit: string;
  region: string;
  updatedAt: string;
}

export interface Activity {
  id: number;
  userId: number;
  factorId?: number | null;
  category: ActivityCategory;
  subType: string;
  amount: string;
  unit: string;
  carbonValue: string;
  recordDate: string;
  note?: string | null;
  factor?: CarbonFactor | null;
}

export interface Goal {
  id: number;
  userId: number;
  title: string;
  targetValue: string;
  periodType: string;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  currentValue?: number;
  progress?: number;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  detail: string;
  ip?: string | null;
  createdAt: string;
}

export interface RankingItem {
  rank: number;
  userId: number;
  username: string;
  region: string;
  avatar?: string | null;
  totalCarbon: number;
}

export interface Organization {
  id: number;
  name: string;
  description: string;
  createdBy: number;
  createdAt?: string;
  activeMembers?: number;
}

export interface OrganizationMembership {
  id: number;
  orgId: number;
  userId: number;
  inviteId?: number | null;
  role: OrganizationMemberRole;
  joinedAt: string;
  leftAt?: string | null;
  username?: string;
  organization?: Organization;
}

export interface OrganizationInvite {
  id: number;
  orgId: number;
  code: string;
  status: OrganizationInviteStatus;
  redeemedBy?: number | null;
  redeemedAt?: string | null;
  createdAt: string;
}

export interface OrganizationMemberSummary {
  membershipId: number;
  userId: number;
  username: string;
  role: OrganizationMemberRole;
  joinedAt: string;
  leftAt?: string | null;
  activityCount: number;
  total: number;
}

export interface OrganizationSummary {
  organization: Organization;
  month: string;
  total: number;
  activityCount: number;
  members: OrganizationMemberSummary[];
  byCategory: { category: ActivityCategory; value: number }[];
  trend: { month: string; value: number }[];
}

export interface OrganizationActivityRow {
  id: number;
  userId: number;
  username: string;
  category: ActivityCategory;
  subType: string;
  amount: string;
  unit: string;
  carbonValue: string;
  recordDate: string;
  note?: string | null;
}

