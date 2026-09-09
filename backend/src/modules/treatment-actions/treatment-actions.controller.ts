import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateTreatmentActionDto } from './dto/create-treatment-action.dto';
import { UpdateTreatmentActionDto } from './dto/update-treatment-action.dto';
import { QueryTreatmentActionsDto } from './dto/query-treatment-actions.dto';
import { TreatmentActionsService } from './treatment-actions.service';

@Controller('treatment-actions')
export class TreatmentActionsController {
  constructor(private readonly treatmentActionsService: TreatmentActionsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTreatmentActionsDto) {
    return this.treatmentActionsService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentActionsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  create(@Body() dto: CreateTreatmentActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentActionsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateTreatmentActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentActionsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentActionsService.remove(id, user);
  }
}
