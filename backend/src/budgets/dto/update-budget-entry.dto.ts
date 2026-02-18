import { PartialType } from '@nestjs/swagger';
import { CreateBudgetEntryDto } from './create-budget-entry.dto';

export class UpdateBudgetEntryDto extends PartialType(CreateBudgetEntryDto) {}
