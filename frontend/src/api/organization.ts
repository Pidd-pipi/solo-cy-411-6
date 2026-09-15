import { Organization, OrganizationActivityRow, OrganizationInvite, OrganizationMembership, OrganizationSummary } from '../types/entities';
import { request } from '../utils/request';

export interface OrganizationPayload {
  name: string;
  description?: string;
}

export function createOrganization(payload: OrganizationPayload): Promise<{ organization: Organization }> {
  return request.post('/organizations', payload);
}

export function fetchOrganizations(): Promise<Organization[]> {
  return request.get('/organizations');
}

export function fetchMyMemberships(): Promise<OrganizationMembership[]> {
  return request.get('/organizations/mine');
}

export function redeemInvite(code: string): Promise<{ organization: Organization }> {
  return request.post('/organizations/redeem', { code });
}

export function fetchOrganizationSummary(orgId: number, month?: string): Promise<OrganizationSummary> {
  return request.get(`/organizations/${orgId}/summary`, { params: { month } });
}

export function fetchOrganizationMembers(orgId: number): Promise<OrganizationMembership[]> {
  return request.get(`/organizations/${orgId}/members`);
}

export function fetchOrganizationActivities(orgId: number, month?: string): Promise<OrganizationActivityRow[]> {
  return request.get(`/organizations/${orgId}/activities`, { params: { month } });
}

export function fetchOrganizationInvites(orgId: number): Promise<OrganizationInvite[]> {
  return request.get(`/organizations/${orgId}/invites`);
}

export function issueOrganizationInvite(orgId: number): Promise<{ invite: OrganizationInvite }> {
  return request.post(`/organizations/${orgId}/invites`);
}

export function leaveOrganization(orgId: number): Promise<{ message: string }> {
  return request.post(`/organizations/${orgId}/leave`);
}

export function removeOrganizationMember(orgId: number, userId: number): Promise<{ message: string }> {
  return request.delete(`/organizations/${orgId}/members/${userId}`);
}
