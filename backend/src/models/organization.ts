import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationInvite } from './organizationInvite';
import { OrganizationMembership } from './organizationMembership';
import { User } from './user';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ length: 128, unique: true })
  name!: string;

  @Column({ length: 255, default: '' })
  description!: string;

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;

  @OneToMany(() => OrganizationMembership, (membership) => membership.organization)
  memberships!: OrganizationMembership[];

  @OneToMany(() => OrganizationInvite, (invite) => invite.organization)
  invites!: OrganizationInvite[];
}
