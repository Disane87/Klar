import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';
import { Household } from '../households/household.entity';
import { BudgetEntry } from '../budgets/budget-entry.entity';

/** A budget category such as Rent, Groceries, Subscriptions. */
@Entity('budget_categories')
export class BudgetCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  householdId: string;

  @ManyToOne(() => Household, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @Column()
  name: string;

  @Column({ default: 'wallet' })
  icon: string;

  @Column({ default: '#6366f1' })
  color: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => BudgetEntry, (entry) => entry.category)
  entries: BudgetEntry[];
}
