import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCodes } from '../constants/errorCodes';
import { RequireAuth } from '../middlewares/auth';
import { RoleGuard, Roles } from '../middlewares/roleCheck';
import { OrganizationInput, OrganizationService } from '../services/organizationService';
import { AppError } from '../utils/AppError';
import { logTemplate } from '../utils/logger';

@Controller('organizations')
@UseGuards(RequireAuth, RoleGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @Roles('admin')
  async create(@Req() request: Request, @Body() body: OrganizationInput) {
    request.auditEntity = 'Organization';
    request.auditAction = 'Organization create';
    try {
      const result = await this.organizationService.createOrganization(request.user!, body);
      request.auditEntityId = Number(result.organization.id);
      return result;
    } catch (error: any) {
      logTemplate('error', 'ORG_CREATE_FAILED', { id: 0, field: 'Organization.name', reason: error.message });
      throw new AppError(error.code || ErrorCodes.VALIDATION_FAILED, `Organization[id=0] controller create failed: name ${error.message}`, error.status || HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  @Roles('admin')
  listAll() {
    return this.organizationService.listAll();
  }

  @Get('mine')
  listMine(@Req() request: Request) {
    return this.organizationService.listMine(request.user!.id);
  }

  @Post('redeem')
  async redeem(@Req() request: Request, @Body() body: { code: string }) {
    request.auditEntity = 'OrganizationInvite';
    request.auditAction = 'OrganizationInvite redeem';
    try {
      const result = await this.organizationService.redeemInvite(request.user!.id, body.code);
      request.auditEntityId = Number(result.organization.id);
      return result;
    } catch (error: any) {
      logTemplate('error', 'ORG_INVITE_REDEEM_FAILED', { code: body?.code || '-', field: 'OrganizationInvite.code', reason: error.message });
      throw new AppError(error.code || ErrorCodes.VALIDATION_FAILED, `OrganizationInvite[code=${body?.code || '-'}] controller redeem failed: code ${error.message}`, error.status || HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id/summary')
  summary(@Req() request: Request, @Param('id') id: string, @Query('month') month?: string) {
    return this.organizationService.getSummary(request.user!, Number(id), month);
  }

  @Get(':id/members')
  members(@Req() request: Request, @Param('id') id: string) {
    return this.organizationService.listMembers(request.user!, Number(id));
  }

  @Get(':id/activities')
  activities(@Req() request: Request, @Param('id') id: string, @Query('month') month?: string, @Query('limit') limit?: string) {
    return this.organizationService.listOrgActivities(request.user!, Number(id), month, limit ? Number(limit) : undefined);
  }

  @Get(':id/invites')
  invites(@Req() request: Request, @Param('id') id: string) {
    return this.organizationService.listInvites(request.user!, Number(id));
  }

  @Post(':id/invites')
  async issueInvite(@Req() request: Request, @Param('id') id: string) {
    request.auditEntity = 'OrganizationInvite';
    request.auditAction = 'OrganizationInvite issue';
    try {
      const result = await this.organizationService.issueInvite(request.user!, Number(id));
      request.auditEntityId = Number(result.invite.id);
      return result;
    } catch (error: any) {
      logTemplate('error', 'ORG_INVITE_ISSUE_FAILED', { id: 0, field: 'OrganizationInvite.org_id', reason: error.message });
      throw new AppError(error.code || ErrorCodes.DATABASE_FAILED, `OrganizationInvite[org_id=${id}] controller issue failed: org_id ${error.message}`, error.status || HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/leave')
  async leave(@Req() request: Request, @Param('id') id: string) {
    request.auditEntity = 'OrganizationMembership';
    request.auditEntityId = Number(id);
    request.auditAction = 'OrganizationMembership leave';
    return this.organizationService.leave(request.user!, Number(id));
  }

  @Delete(':id/members/:userId')
  async removeMember(@Req() request: Request, @Param('id') id: string, @Param('userId') userId: string) {
    request.auditEntity = 'OrganizationMembership';
    request.auditEntityId = Number(userId);
    request.auditAction = 'OrganizationMembership remove';
    return this.organizationService.removeMember(request.user!, Number(id), Number(userId));
  }
}
