import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationInviteStatus } from '../constants/organization';
import { Organization } from './organization';
import { User } from './user';

@Entity('organization_invites')
export class OrganizationInvite {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'org_id', type: 'bigint' })
  orgId!: number;

  @Column({ length: 64, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: OrganizationInviteStatus, default: OrganizationInviteStatus.UNUSED })
  status!: OrganizationInviteStatus;

  @Column({ name: 'redeemed_by', type: 'bigint', nullable: true })
  redeemedBy!: number | null;

  @Column({ name: 'redeemed_at', type: 'timestamp', nullable: true })
  redeemedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => Organization, (organization) => organization.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'redeemed_by' })
  redeemer!: User | null;
}
