import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Household } from './household.entity';
import { HouseholdMember, HouseholdRole } from './household-member.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { IncomesService } from '../incomes/incomes.service';
import { BudgetsService } from '../budgets/budgets.service';

/** Service for managing households and their members. */
@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
    @InjectRepository(HouseholdMember)
    private readonly memberRepo: Repository<HouseholdMember>,
    private readonly incomesService: IncomesService,
    private readonly budgetsService: BudgetsService,
  ) {}

  /** List all households the user belongs to. */
  async findAllForUser(userId: string): Promise<Household[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['household'],
    });
    return memberships.map((m) => m.household);
  }

  /** Get household details including members. */
  async findOne(id: string, userId: string): Promise<Household> {
    await this.ensureMembership(id, userId);
    const household = await this.householdRepo.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }

  /** Create a new household — the creator becomes ADMIN. */
  async create(userId: string, dto: CreateHouseholdDto): Promise<Household> {
    const household = this.householdRepo.create({
      name: dto.name,
      inviteCode: uuidv4().slice(0, 8),
    });
    const saved = await this.householdRepo.save(household);

    const member = this.memberRepo.create({
      householdId: saved.id,
      userId,
      role: HouseholdRole.ADMIN,
    });
    await this.memberRepo.save(member);

    return saved;
  }

  /** Join a household using an invite code. */
  async join(userId: string, inviteCode: string): Promise<Household> {
    const household = await this.householdRepo.findOne({
      where: { inviteCode },
    });
    if (!household) throw new NotFoundException('Invalid invite code');

    const existing = await this.memberRepo.findOne({
      where: { householdId: household.id, userId },
    });
    if (existing) throw new ConflictException('Already a member');

    const member = this.memberRepo.create({
      householdId: household.id,
      userId,
      role: HouseholdRole.MEMBER,
    });
    await this.memberRepo.save(member);

    return household;
  }

  /** List members of a household. */
  async getMembers(householdId: string, userId: string): Promise<HouseholdMember[]> {
    await this.ensureMembership(householdId, userId);
    return this.memberRepo.find({
      where: { householdId },
      relations: ['user'],
    });
  }

  /** Update a member's role (admin only). */
  async updateMemberRole(
    householdId: string,
    targetUserId: string,
    role: HouseholdRole,
    currentUserId: string,
  ): Promise<HouseholdMember> {
    await this.ensureAdmin(householdId, currentUserId);

    const member = await this.memberRepo.findOne({
      where: { householdId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Member not found');

    member.role = role;
    return this.memberRepo.save(member);
  }

  /** Remove a member from a household (admin only, or self-removal). */
  async removeMember(
    householdId: string,
    targetUserId: string,
    currentUserId: string,
  ): Promise<void> {
    if (targetUserId !== currentUserId) {
      await this.ensureAdmin(householdId, currentUserId);
    }

    const result = await this.memberRepo.delete({
      householdId,
      userId: targetUserId,
    });
    if (result.affected === 0) throw new NotFoundException('Member not found');
  }

  /** Get a combined financial summary for a household. */
  async getHouseholdSummary(householdId: string, userId: string, month: number, year: number) {
    await this.ensureMembership(householdId, userId);

    const members = await this.memberRepo.find({
      where: { householdId },
      relations: ['user'],
    });

    const incomes = await this.incomesService.findByHousehold(householdId, month, year);
    const expenses = await this.budgetsService.findByHousehold(householdId, month, year);

    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const perMember = members.map((m) => {
      const memberIncomes = incomes.filter((i) => i.userId === m.userId);
      const memberExpenses = expenses.filter((e) => e.userId === m.userId);
      return {
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        totalIncome: memberIncomes.reduce((sum, i) => sum + Number(i.amount), 0),
        totalExpenses: memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      };
    });

    return {
      householdId,
      month,
      year,
      totalIncome,
      totalExpenses,
      remaining: totalIncome - totalExpenses,
      members: perMember,
    };
  }

  /** Verify the user is a member of the household. */
  private async ensureMembership(householdId: string, userId: string): Promise<HouseholdMember> {
    const member = await this.memberRepo.findOne({
      where: { householdId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this household');
    return member;
  }

  /** Verify the user is an admin of the household. */
  private async ensureAdmin(householdId: string, userId: string): Promise<void> {
    const member = await this.ensureMembership(householdId, userId);
    if (member.role !== HouseholdRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
