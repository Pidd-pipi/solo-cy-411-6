import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationMemberRole } from '../constants/organization';
import { Organization } from './organization';
import { OrganizationInvite } from './organizationInvite';
import { User } from './user';

@Entity('organization_memberships')
export class OrganizationMembership {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'org_id', type: 'bigint' })
  orgId!: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @Column({ name: 'invite_id', type: 'bigint', nullable: true })
  inviteId!: number | null;

  @Column({ type: 'enum', enum: OrganizationMemberRole, default: OrganizationMemberRole.MEMBER })
  role!: OrganizationMemberRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamp' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamp', nullable: true })
  leftAt!: Date | null;

  @ManyToOne(() => Organization, (organization) => organization.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => OrganizationInvite, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invite_id' })
  invite!: OrganizationInvite | null;
}
