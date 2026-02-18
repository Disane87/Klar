import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { BudgetCategory } from '../categories/category.entity';
import { Household } from '../households/household.entity';

/** A single budget/expense entry within a category for a given month. */
@Entity('budget_entries')
export class BudgetEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  categoryId: string;

  @ManyToOne(() => BudgetCategory, (cat) => cat.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: BudgetCategory;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.budgetEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  householdId: string;

  @ManyToOne(() => Household, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @Column()
  name: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ default: true })
  isRecurring: boolean;

  @Column()
  month: number;

  @Column()
  year: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
