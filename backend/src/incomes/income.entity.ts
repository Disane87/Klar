import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Household } from '../households/household.entity';

/** Represents a monthly income source for a user. */
@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.incomes, { onDelete: 'CASCADE' })
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

  @Column()
  month: number;

  @Column()
  year: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
