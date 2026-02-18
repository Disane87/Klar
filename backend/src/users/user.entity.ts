import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Income } from '../incomes/income.entity';
import { BudgetEntry } from '../budgets/budget-entry.entity';
import { HouseholdMember } from '../households/household-member.entity';

/** Represents an authenticated user in the system. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  oidcSubject: string;

  @Column()
  email: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Income, (income) => income.user)
  incomes: Income[];

  @OneToMany(() => BudgetEntry, (entry) => entry.user)
  budgetEntries: BudgetEntry[];

  @OneToMany(() => HouseholdMember, (member) => member.user)
  householdMemberships: HouseholdMember[];
}
