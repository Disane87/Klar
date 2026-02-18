import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetCategory } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** Service for managing budget categories. */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(BudgetCategory)
    private readonly categoryRepo: Repository<BudgetCategory>,
  ) {}

  /** List categories visible to the user (personal + household). */
  async findAll(userId: string, householdId?: string): Promise<BudgetCategory[]> {
    const query = this.categoryRepo
      .createQueryBuilder('cat')
      .where('cat.userId = :userId', { userId });

    if (householdId) {
      query.orWhere('cat.householdId = :householdId', { householdId });
    }

    return query.orderBy('cat.name', 'ASC').getMany();
  }

  /** Create a new budget category. */
  async create(userId: string, dto: CreateCategoryDto): Promise<BudgetCategory> {
    const category = this.categoryRepo.create({
      ...dto,
      userId: dto.householdId ? null : userId,
    });
    return this.categoryRepo.save(category);
  }

  /** Update a budget category. */
  async update(id: string, userId: string, dto: UpdateCategoryDto): Promise<BudgetCategory> {
    const category = await this.categoryRepo.findOne({
      where: [
        { id, userId },
        { id, householdId: dto.householdId },
      ],
    });
    if (!category) throw new NotFoundException('Category not found');
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  /** Delete a budget category. */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.categoryRepo.delete({ id, userId });
    if (result.affected === 0) throw new NotFoundException('Category not found');
  }
}
