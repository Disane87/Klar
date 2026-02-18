import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { BudgetsService } from './budgets.service';
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List budget entries' })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  findAll(
    @CurrentUser() user: User,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.budgetsService.findAll(user.id, month, year);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly budget summary' })
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'year', required: true })
  getSummary(
    @CurrentUser() user: User,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.budgetsService.getSummary(user.id, +month, +year);
  }

  @Post()
  @ApiOperation({ summary: 'Create a budget entry' })
  create(@CurrentUser() user: User, @Body() dto: CreateBudgetEntryDto) {
    return this.budgetsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a budget entry' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetEntryDto,
  ) {
    return this.budgetsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget entry' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.budgetsService.remove(id, user.id);
  }
}
