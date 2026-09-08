import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { LinkRisksDto } from './dto/link-risks.dto';
import { RiskAssessmentsService } from './risk-assessments.service';

@Controller('risk-assessments')
export class RiskAssessmentsController {
  constructor(private readonly riskAssessmentsService: RiskAssessmentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateAssessmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.update(id, dto, user);
  }

  @Put(':id/risks')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  updateLinkedRisks(@Param('id') id: string, @Body() dto: LinkRisksDto, @CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.updateLinkedRisks(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.riskAssessmentsService.remove(id, user);
  }
}
