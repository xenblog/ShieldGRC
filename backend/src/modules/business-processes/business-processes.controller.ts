import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateBusinessProcessDto } from './dto/create-business-process.dto';
import { UpdateBusinessProcessDto } from './dto/update-business-process.dto';
import { QueryBusinessProcessesDto } from './dto/query-business-processes.dto';
import { LinkRisksDto } from './dto/link-risks.dto';
import { BusinessProcessesService } from './business-processes.service';

@Controller('business-processes')
export class BusinessProcessesController {
  constructor(private readonly businessProcessesService: BusinessProcessesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryBusinessProcessesDto) {
    return this.businessProcessesService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.businessProcessesService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  create(@Body() dto: CreateBusinessProcessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.businessProcessesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateBusinessProcessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.businessProcessesService.update(id, dto, user);
  }

  @Put(':id/risks')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  updateLinkedRisks(@Param('id') id: string, @Body() dto: LinkRisksDto, @CurrentUser() user: AuthenticatedUser) {
    return this.businessProcessesService.updateLinkedRisks(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.businessProcessesService.remove(id, user);
  }
}
