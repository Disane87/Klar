import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Income } from './income.entity';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';

/** Service for managing income entries. */
@Injectable()
export class IncomesService {
  constructor(
    @InjectRepository(Income)
    private readonly incomeRepo: Repository<Income>,
  ) {}

  /** List all incomes for a user, optionally filtered by month/year. */
  async findAll(
    userId: string,
    month?: number,
    year?: number,
  ): Promise<Income[]> {
    const query = this.incomeRepo
      .createQueryBuilder('income')
      .where('income.userId = :userId', { userId });

    if (month) query.andWhere('income.month = :month', { month });
    if (year) query.andWhere('income.year = :year', { year });

    return query.orderBy('income.createdAt', 'DESC').getMany();
  }

  /** Find incomes belonging to a household for a given month/year. */
  async findByHousehold(
    householdId: string,
    month?: number,
    year?: number,
  ): Promise<Income[]> {
    const query = this.incomeRepo
      .createQueryBuilder('income')
      .leftJoinAndSelect('income.user', 'user')
      .where('income.householdId = :householdId', { householdId });

    if (month) query.andWhere('income.month = :month', { month });
    if (year) query.andWhere('income.year = :year', { year });

    return query.orderBy('income.createdAt', 'DESC').getMany();
  }

  /** Create a new income entry. */
  async create(userId: string, dto: CreateIncomeDto): Promise<Income> {
    const income = this.incomeRepo.create({ ...dto, userId });
    return this.incomeRepo.save(income);
  }

  /** Update an existing income entry. */
  async update(
    id: string,
    userId: string,
    dto: UpdateIncomeDto,
  ): Promise<Income> {
    const income = await this.incomeRepo.findOne({ where: { id, userId } });
    if (!income) throw new NotFoundException('Income not found');
    Object.assign(income, dto);
    return this.incomeRepo.save(income);
  }

  /** Delete an income entry. */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.incomeRepo.delete({ id, userId });
    if (result.affected === 0) throw new NotFoundException('Income not found');
  }

  /** Sum all incomes for a user in a given month/year. */
  async sumForUser(userId: string, month: number, year: number): Promise<number> {
    const result = await this.incomeRepo
      .createQueryBuilder('income')
      .select('COALESCE(SUM(income.amount), 0)', 'total')
      .where('income.userId = :userId', { userId })
      .andWhere('income.month = :month', { month })
      .andWhere('income.year = :year', { year })
      .getRawOne();
    return parseFloat(result.total);
  }
}
