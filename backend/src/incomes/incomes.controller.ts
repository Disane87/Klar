import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { IncomesService } from './incomes.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';

@ApiTags('Incomes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incomes')
export class IncomesController {
  constructor(private readonly incomesService: IncomesService) {}

  @Get()
  @ApiOperation({ summary: 'List all incomes for the current user' })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  findAll(
    @CurrentUser() user: User,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.incomesService.findAll(user.id, month, year);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new income entry' })
  create(@CurrentUser() user: User, @Body() dto: CreateIncomeDto) {
    return this.incomesService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an income entry' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    return this.incomesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an income entry' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.incomesService.remove(id, user.id);
  }
}
