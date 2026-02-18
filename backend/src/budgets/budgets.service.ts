import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetEntry } from './budget-entry.entity';
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';
import { IncomesService } from '../incomes/incomes.service';

/** Service for managing budget entries and computing summaries. */
@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    private readonly incomesService: IncomesService,
  ) {}

  /** List all budget entries for a user, optionally filtered. */
  async findAll(
    userId: string,
    month?: number,
    year?: number,
  ): Promise<BudgetEntry[]> {
    const query = this.budgetRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.category', 'category')
      .where('entry.userId = :userId', { userId });

    if (month) query.andWhere('entry.month = :month', { month });
    if (year) query.andWhere('entry.year = :year', { year });

    return query.orderBy('entry.createdAt', 'DESC').getMany();
  }

  /** Find budget entries belonging to a household. */
  async findByHousehold(
    householdId: string,
    month?: number,
    year?: number,
  ): Promise<BudgetEntry[]> {
    const query = this.budgetRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.category', 'category')
      .leftJoinAndSelect('entry.user', 'user')
      .where('entry.householdId = :householdId', { householdId });

    if (month) query.andWhere('entry.month = :month', { month });
    if (year) query.andWhere('entry.year = :year', { year });

    return query.orderBy('entry.createdAt', 'DESC').getMany();
  }

  /** Create a new budget entry. */
  async create(userId: string, dto: CreateBudgetEntryDto): Promise<BudgetEntry> {
    const entry = this.budgetRepo.create({ ...dto, userId });
    return this.budgetRepo.save(entry);
  }

  /** Update an existing budget entry. */
  async update(
    id: string,
    userId: string,
    dto: UpdateBudgetEntryDto,
  ): Promise<BudgetEntry> {
    const entry = await this.budgetRepo.findOne({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Budget entry not found');
    Object.assign(entry, dto);
    return this.budgetRepo.save(entry);
  }

  /** Delete a budget entry. */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.budgetRepo.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Budget entry not found');
    }
  }

  /** Compute a monthly budget summary for a user. */
  async getSummary(userId: string, month: number, year: number) {
    const totalIncome = await this.incomesService.sumForUser(userId, month, year);

    const expenseResult = await this.budgetRepo
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.amount), 0)', 'total')
      .where('entry.userId = :userId', { userId })
      .andWhere('entry.month = :month', { month })
      .andWhere('entry.year = :year', { year })
      .getRawOne();

    const totalExpenses = parseFloat(expenseResult.total);

    const categoryBreakdown = await this.budgetRepo
      .createQueryBuilder('entry')
      .leftJoin('entry.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('category.icon', 'categoryIcon')
      .addSelect('category.color', 'categoryColor')
      .addSelect('SUM(entry.amount)', 'total')
      .where('entry.userId = :userId', { userId })
      .andWhere('entry.month = :month', { month })
      .andWhere('entry.year = :year', { year })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .addGroupBy('category.icon')
      .addGroupBy('category.color')
      .getRawMany();

    return {
      month,
      year,
      totalIncome,
      totalExpenses,
      remaining: totalIncome - totalExpenses,
      categoryBreakdown: categoryBreakdown.map((row) => ({
        categoryId: row.categoryId,
        name: row.categoryName,
        icon: row.categoryIcon,
        color: row.categoryColor,
        total: parseFloat(row.total),
      })),
    };
  }
}
