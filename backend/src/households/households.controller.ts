import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { JoinHouseholdDto } from './dto/join-household.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('Households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  @ApiOperation({ summary: 'List households the user belongs to' })
  findAll(@CurrentUser() user: User) {
    return this.householdsService.findAllForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new household' })
  create(@CurrentUser() user: User, @Body() dto: CreateHouseholdDto) {
    return this.householdsService.create(user.id, dto);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join a household via invite code' })
  join(@CurrentUser() user: User, @Body() dto: JoinHouseholdDto) {
    return this.householdsService.join(user.id, dto.inviteCode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get household details' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.householdsService.findOne(id, user.id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get household financial summary' })
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'year', required: true })
  getSummary(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.householdsService.getHouseholdSummary(id, user.id, +month, +year);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List household members' })
  getMembers(@CurrentUser() user: User, @Param('id') id: string) {
    return this.householdsService.getMembers(id, user.id);
  }

  @Put(':id/members/:userId')
  @ApiOperation({ summary: 'Update a member role' })
  updateMemberRole(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.householdsService.updateMemberRole(id, targetUserId, dto.role, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from household' })
  removeMember(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.householdsService.removeMember(id, targetUserId, user.id);
  }
}
