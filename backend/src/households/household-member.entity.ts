import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Household } from './household.entity';

export enum HouseholdRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

/** Join table linking users to households with a role. */
@Entity('household_members')
export class HouseholdMember {
  @PrimaryColumn()
  householdId: string;

  @PrimaryColumn()
  userId: string;

  @ManyToOne(() => Household, (h) => h.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @ManyToOne(() => User, (u) => u.householdMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: HouseholdRole, default: HouseholdRole.MEMBER })
  role: HouseholdRole;

  @CreateDateColumn()
  joinedAt: Date;
}
