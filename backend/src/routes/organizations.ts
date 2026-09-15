import { OrganizationController } from '../controllers/organizationController';
import { OrganizationInviteStatus, OrganizationMemberRole } from '../constants/organization';
import { logTemplate } from '../utils/logger';

export const organizationRoutes = [
  'POST /organizations requireAuth role=admin audit',
  'GET /organizations requireAuth role=admin',
  'GET /organizations/mine requireAuth',
  'POST /organizations/redeem requireAuth audit atomic',
  'GET /organizations/:id/summary requireAuth orgMember',
  'GET /organizations/:id/members requireAuth orgMember',
  'GET /organizations/:id/activities requireAuth orgAdmin windowed',
  'GET /organizations/:id/invites requireAuth orgAdmin',
  'POST /organizations/:id/invites requireAuth orgAdmin audit',
  'POST /organizations/:id/leave requireAuth audit',
  'DELETE /organizations/:id/members/:userId requireAuth orgAdmin audit'
];

logTemplate('info', 'ORG_LIST_START', {
  values: `${Object.values(OrganizationInviteStatus).join(',')}|${Object.values(OrganizationMemberRole).join(',')}`
});
export const organizationRouteControllers = [OrganizationController];
