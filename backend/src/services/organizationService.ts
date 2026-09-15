import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { DataSource, IsNull, Repository } from 'typeorm';
import { OrganizationInviteStatus, OrganizationMemberRole } from '../constants/organization';
import { ErrorCodes } from '../constants/errorCodes';
import { Messages } from '../constants/messages';
import { Organization } from '../models/organization';
import { OrganizationInvite } from '../models/organizationInvite';
import { OrganizationMembership } from '../models/organizationMembership';
import { AuthUser } from '../types/auth';
import { AppError } from '../utils/AppError';
import { logTemplate } from '../utils/logger';

export interface OrganizationInput {
  name: string;
  description?: string;
}

/**
 * 归属窗口谓词:活动 record_date 落在 [joined_at 当日, left_at 当日] 闭区间内才计入组织归集。
 * record_date 为天粒度,离开当天仍视为归属期内,保证"退出后既有活动留在组织历史";
 * 窗口之后的活动不再计入。月度归集、成员贡献、分类拆分、趋势、组织活动流全部复用同一谓词,
 * 且全部实时派生自 activities 表(不做冗余计数器),因此组织归集与个人统计永远同源一致。
 */
const MEMBERSHIP_WINDOW_SQL = 'a.record_date >= DATE(m.joined_at) AND (m.left_at IS NULL OR a.record_date <= DATE(m.left_at))';

const MEMBERSHIP_WINDOW_EXISTS_SQL = `EXISTS (
  SELECT 1 FROM organization_memberships m
  WHERE m.org_id = ? AND m.user_id = a.user_id AND ${MEMBERSHIP_WINDOW_SQL}
)`;

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization) private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(OrganizationInvite) private readonly inviteRepo: Repository<OrganizationInvite>,
    @InjectRepository(OrganizationMembership) private readonly membershipRepo: Repository<OrganizationMembership>,
    private readonly dataSource: DataSource
  ) {}

  async findOrg(id: number) {
    const organization = await this.organizationRepo.findOne({ where: { id } });
    if (!organization) {
      throw new AppError(ErrorCodes.ORG_NOT_FOUND, `Organization[id=${id}] read failed: id not found`, HttpStatus.NOT_FOUND);
    }
    return organization;
  }

  private async activeMembership(userId: number, orgId: number) {
    return this.membershipRepo.findOne({ where: { userId, orgId, leftAt: IsNull() } });
  }

  private async assertOrgMember(actor: AuthUser, orgId: number) {
    if (actor.roles.includes('admin')) return;
    const membership = await this.activeMembership(actor.id, orgId);
    if (!membership) {
      logTemplate('warn', 'ORG_ACCESS_DENIED', { id: orgId, userId: actor.id, reason: 'active membership required' });
      throw new AppError(ErrorCodes.ORG_ACCESS_DENIED, `Organization[id=${orgId}] access failed: active membership required`, HttpStatus.FORBIDDEN);
    }
  }

  private async assertOrgAdmin(actor: AuthUser, orgId: number) {
    if (actor.roles.includes('admin')) return;
    const membership = await this.activeMembership(actor.id, orgId);
    if (!membership || membership.role !== OrganizationMemberRole.ADMIN) {
      logTemplate('warn', 'ORG_ACCESS_DENIED', { id: orgId, userId: actor.id, reason: 'org admin role required' });
      throw new AppError(ErrorCodes.ORG_ACCESS_DENIED, `Organization[id=${orgId}] access failed: org admin role required`, HttpStatus.FORBIDDEN);
    }
  }

  async createOrganization(actor: AuthUser, input: OrganizationInput) {
    logTemplate('info', 'ORG_CREATE_START', { name: input.name, userId: actor.id });
    const existing = await this.organizationRepo.findOne({ where: { name: input.name } });
    if (existing) {
      logTemplate('warn', 'ORG_CREATE_FAILED', { id: 0, field: 'Organization.name', reason: 'name duplicate' });
      throw new AppError(ErrorCodes.ORG_NAME_DUPLICATE, `Organization[name=${input.name}] create failed: name duplicate`, HttpStatus.CONFLICT);
    }
    const organization = await this.dataSource.transaction(async (manager) => {
      const org = await manager.save(Organization, manager.create(Organization, {
        name: input.name,
        description: input.description || '',
        createdBy: actor.id
      }));
      await manager.insert(OrganizationMembership, {
        orgId: Number(org.id),
        userId: actor.id,
        inviteId: null,
        role: OrganizationMemberRole.ADMIN
      });
      return org;
    });
    logTemplate('info', 'ORG_CREATE_SUCCESS', { id: organization.id, name: organization.name });
    return { message: Messages.ORG_CREATED, organization };
  }

  async listAll() {
    logTemplate('info', 'ORG_LIST_START');
    const rows = await this.organizationRepo.query(
      `SELECT o.id, o.name, o.description, o.created_by AS createdBy, o.created_at AS createdAt,
              (SELECT COUNT(*) FROM organization_memberships m WHERE m.org_id = o.id AND m.left_at IS NULL) AS activeMembers
       FROM organizations o ORDER BY o.id ASC`
    );
    return rows.map((row: any) => ({ ...row, id: Number(row.id), createdBy: Number(row.createdBy), activeMembers: Number(row.activeMembers) }));
  }

  async listMine(userId: number) {
    logTemplate('info', 'ORG_LIST_START');
    return this.membershipRepo.find({ where: { userId }, relations: ['organization'], order: { joinedAt: 'DESC' } });
  }

  async issueInvite(actor: AuthUser, orgId: number) {
    logTemplate('info', 'ORG_INVITE_ISSUE_START', { orgId, userId: actor.id });
    await this.findOrg(orgId);
    await this.assertOrgAdmin(actor, orgId);
    let invite: OrganizationInvite | null = null;
    for (let attempt = 0; attempt < 3 && !invite; attempt += 1) {
      const code = `ORG-${randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        invite = await this.inviteRepo.save(this.inviteRepo.create({ orgId, code, status: OrganizationInviteStatus.UNUSED }));
      } catch (error: any) {
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    if (!invite) {
      logTemplate('error', 'ORG_INVITE_ISSUE_FAILED', { id: 0, field: 'OrganizationInvite.code', reason: 'code collision after retries' });
      throw new AppError(ErrorCodes.DATABASE_FAILED, `OrganizationInvite[org_id=${orgId}] issue failed: code collision after retries`);
    }
    logTemplate('info', 'ORG_INVITE_ISSUE_SUCCESS', { id: invite.id, orgId });
    return { message: Messages.ORG_INVITE_ISSUED, invite };
  }

  async listInvites(actor: AuthUser, orgId: number) {
    await this.findOrg(orgId);
    await this.assertOrgAdmin(actor, orgId);
    return this.inviteRepo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  /**
   * 一次性邀请码原子兑换:
   * 1. UPDATE ... WHERE code=? AND status='unused' 是数据库级原子认领,并发下只有一个事务 affectedRows=1;
   * 2. memberships.active_user_id 生成列唯一索引兜底,保证同一用户全局仅一条有效归属;
   * 3. 任一步失败整体回滚,邀请码恢复 unused,不会出现"码已核销但归属未建"的中间态。
   */
  async redeemInvite(userId: number, code: string) {
    logTemplate('info', 'ORG_INVITE_REDEEM_START', { code, userId });
    const active = await this.membershipRepo.findOne({ where: { userId, leftAt: IsNull() } });
    if (active) {
      logTemplate('warn', 'ORG_INVITE_REDEEM_FAILED', { code, field: 'OrganizationMembership.user_id', reason: 'active membership already exists' });
      throw new AppError(ErrorCodes.ORG_MEMBERSHIP_DUPLICATE, `OrganizationMembership[user_id=${userId}] redeem failed: active membership already exists in org_id=${active.orgId}`, HttpStatus.CONFLICT);
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const claim = await manager.query(
          `UPDATE organization_invites SET status = ?, redeemed_by = ?, redeemed_at = NOW() WHERE code = ? AND status = ?`,
          [OrganizationInviteStatus.REDEEMED, userId, code, OrganizationInviteStatus.UNUSED]
        );
        if (!claim.affectedRows) {
          const existing = await manager.findOne(OrganizationInvite, { where: { code } });
          if (!existing) {
            throw new AppError(ErrorCodes.INVITE_NOT_FOUND, `OrganizationInvite[code=${code}] redeem failed: code not found`, HttpStatus.NOT_FOUND);
          }
          throw new AppError(ErrorCodes.INVITE_ALREADY_REDEEMED, `OrganizationInvite[code=${code}] redeem failed: code already ${existing.status}`, HttpStatus.CONFLICT);
        }
        const invite = await manager.findOneOrFail(OrganizationInvite, { where: { code } });
        try {
          await manager.insert(OrganizationMembership, {
            orgId: Number(invite.orgId),
            userId,
            inviteId: Number(invite.id),
            role: OrganizationMemberRole.MEMBER
          });
        } catch (error: any) {
          if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
            throw new AppError(ErrorCodes.ORG_MEMBERSHIP_DUPLICATE, `OrganizationMembership[user_id=${userId}] redeem failed: active membership already exists`, HttpStatus.CONFLICT);
          }
          throw error;
        }
        const organization = await manager.findOneOrFail(Organization, { where: { id: Number(invite.orgId) } });
        logTemplate('info', 'ORG_INVITE_REDEEM_SUCCESS', { id: invite.id, orgId: invite.orgId, userId });
        return { message: Messages.ORG_INVITE_REDEEMED, organization };
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logTemplate('error', 'ORG_INVITE_REDEEM_FAILED', { code, field: 'OrganizationInvite.code', reason: error.message });
      throw new AppError(ErrorCodes.DATABASE_FAILED, `OrganizationInvite[code=${code}] redeem failed: ${error.message}`);
    }
  }

  async leave(actor: AuthUser, orgId: number) {
    await this.findOrg(orgId);
    const membership = await this.activeMembership(actor.id, orgId);
    if (!membership) {
      throw new AppError(ErrorCodes.ORG_MEMBERSHIP_NOT_FOUND, `OrganizationMembership[org_id=${orgId}, user_id=${actor.id}] leave failed: active membership not found`, HttpStatus.NOT_FOUND);
    }
    membership.leftAt = new Date();
    const saved = await this.membershipRepo.save(membership);
    logTemplate('info', 'ORG_LEAVE_SUCCESS', { id: saved.id, orgId, userId: actor.id });
    return { message: Messages.ORG_LEFT, membership: saved };
  }

  async removeMember(actor: AuthUser, orgId: number, targetUserId: number) {
    await this.findOrg(orgId);
    await this.assertOrgAdmin(actor, orgId);
    const membership = await this.activeMembership(targetUserId, orgId);
    if (!membership) {
      throw new AppError(ErrorCodes.ORG_MEMBERSHIP_NOT_FOUND, `OrganizationMembership[org_id=${orgId}, user_id=${targetUserId}] remove failed: active membership not found`, HttpStatus.NOT_FOUND);
    }
    if (membership.role === OrganizationMemberRole.ADMIN && !actor.roles.includes('admin') && targetUserId !== actor.id) {
      logTemplate('warn', 'ORG_ACCESS_DENIED', { id: orgId, userId: actor.id, reason: 'cannot remove another org admin' });
      throw new AppError(ErrorCodes.ORG_ACCESS_DENIED, `OrganizationMembership[id=${membership.id}] remove failed: org admin role required`, HttpStatus.FORBIDDEN);
    }
    membership.leftAt = new Date();
    const saved = await this.membershipRepo.save(membership);
    logTemplate('info', 'ORG_MEMBER_REMOVE_SUCCESS', { id: saved.id, orgId, userId: targetUserId });
    return { message: Messages.ORG_MEMBER_REMOVED, membership: saved };
  }

  async listMembers(actor: AuthUser, orgId: number) {
    await this.findOrg(orgId);
    await this.assertOrgMember(actor, orgId);
    const rows = await this.membershipRepo.query(
      `SELECT m.id, m.org_id AS orgId, m.user_id AS userId, u.username, m.role, m.invite_id AS inviteId,
              DATE_FORMAT(m.joined_at, '%Y-%m-%d %H:%i:%s') AS joinedAt,
              DATE_FORMAT(m.left_at, '%Y-%m-%d %H:%i:%s') AS leftAt
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ?
       ORDER BY (m.left_at IS NULL) DESC, m.joined_at DESC`,
      [orgId]
    );
    return rows.map((row: any) => ({ ...row, id: Number(row.id), orgId: Number(row.orgId), userId: Number(row.userId), inviteId: row.inviteId === null ? null : Number(row.inviteId) }));
  }

  private normalizeMonth(month?: string) {
    return month && /^\d{4}-\d{2}$/.test(month) ? month : dayjs().format('YYYY-MM');
  }

  /**
   * 组织月度归集:成员贡献逐行求和得到 total,与分类拆分、趋势、活动流共用同一窗口谓词,
   * 因此 total === Σ members.total === Σ byCategory.value === 活动流当月碳值之和,与个人统计同源。
   */
  async getSummary(actor: AuthUser, orgId: number, monthInput?: string) {
    const organization = await this.findOrg(orgId);
    await this.assertOrgMember(actor, orgId);
    const month = this.normalizeMonth(monthInput);
    const memberRows = await this.membershipRepo.query(
      `SELECT m.id AS membershipId, m.user_id AS userId, u.username, m.role,
              DATE_FORMAT(m.joined_at, '%Y-%m-%d %H:%i:%s') AS joinedAt,
              DATE_FORMAT(m.left_at, '%Y-%m-%d %H:%i:%s') AS leftAt,
              COUNT(a.id) AS activityCount,
              COALESCE(SUM(a.carbon_value), 0) AS total
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN activities a
         ON a.user_id = m.user_id
        AND ${MEMBERSHIP_WINDOW_SQL}
        AND DATE_FORMAT(a.record_date, '%Y-%m') = ?
       WHERE m.org_id = ?
       GROUP BY m.id, m.user_id, u.username, m.role, m.joined_at, m.left_at
       ORDER BY (m.left_at IS NULL) DESC, total DESC`,
      [month, orgId]
    );
    const members = memberRows.map((row: any) => ({
      membershipId: Number(row.membershipId),
      userId: Number(row.userId),
      username: row.username,
      role: row.role,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
      activityCount: Number(row.activityCount),
      total: Number(Number(row.total).toFixed(2))
    }));
    const categoryRows = await this.membershipRepo.query(
      `SELECT a.category AS category, COALESCE(SUM(a.carbon_value), 0) AS value
       FROM activities a
       WHERE ${MEMBERSHIP_WINDOW_EXISTS_SQL}
         AND DATE_FORMAT(a.record_date, '%Y-%m') = ?
       GROUP BY a.category`,
      [orgId, month]
    );
    const trendRows = await this.membershipRepo.query(
      `SELECT DATE_FORMAT(a.record_date, '%Y-%m') AS month, COALESCE(SUM(a.carbon_value), 0) AS total
       FROM activities a
       WHERE ${MEMBERSHIP_WINDOW_EXISTS_SQL}
         AND a.record_date >= DATE_FORMAT(DATE_SUB(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'), INTERVAL 5 MONTH), '%Y-%m-01')
         AND a.record_date < DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m-01')
       GROUP BY month
       ORDER BY month ASC`,
      [orgId, month, month]
    );
    const total = Number(members.reduce((sum: number, row: { total: number }) => sum + row.total, 0).toFixed(2));
    const activityCount = members.reduce((sum: number, row: { activityCount: number }) => sum + row.activityCount, 0);
    logTemplate('info', 'ORG_SUMMARY_CALCULATED', { id: orgId, month, total });
    return {
      organization,
      month,
      total,
      activityCount,
      members,
      byCategory: categoryRows.map((row: any) => ({ category: row.category, value: Number(Number(row.value).toFixed(2)) })),
      trend: trendRows.map((row: any) => ({ month: row.month, value: Number(Number(row.total).toFixed(2)) }))
    };
  }

  /**
   * 组织管理员可见的活动流:与归集完全相同的窗口谓词 + EXISTS 去重,
   * 归属窗口之外的个人私有记录永不返回。
   */
  async listOrgActivities(actor: AuthUser, orgId: number, monthInput?: string, limitInput?: number) {
    await this.findOrg(orgId);
    await this.assertOrgAdmin(actor, orgId);
    const month = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : undefined;
    const limit = Math.min(Math.max(Number(limitInput) || 100, 1), 500);
    const params: unknown[] = [orgId];
    let monthFilter = '';
    if (month) {
      monthFilter = `AND DATE_FORMAT(a.record_date, '%Y-%m') = ?`;
      params.push(month);
    }
    params.push(limit);
    const rows = await this.membershipRepo.query(
      `SELECT a.id, a.user_id AS userId, u.username, a.category, a.sub_type AS subType,
              a.amount, a.unit, a.carbon_value AS carbonValue,
              DATE_FORMAT(a.record_date, '%Y-%m-%d') AS recordDate, a.note
       FROM activities a
       JOIN users u ON u.id = a.user_id
       WHERE ${MEMBERSHIP_WINDOW_EXISTS_SQL}
       ${monthFilter}
       ORDER BY a.record_date DESC, a.id DESC
       LIMIT ?`,
      params
    );
    return rows.map((row: any) => ({ ...row, id: Number(row.id), userId: Number(row.userId) }));
  }
}
