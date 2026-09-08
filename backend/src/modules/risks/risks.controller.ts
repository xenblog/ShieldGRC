import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { QueryRisksDto } from './dto/query-risks.dto';
import { RisksService } from './risks.service';

@Controller('risks')
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  // NOTE: 'grouped' and 'heat-map' must stay declared before ':id' or Nest
  // will try to resolve them as a risk id instead of routing here.
  @Get('grouped')
  findGrouped(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRisksDto) {
    return this.risksService.findGrouped(user, query);
  }

  @Get('heat-map')
  findHeatMap(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRisksDto) {
    return this.risksService.findHeatMap(user, query);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRisksDto) {
    return this.risksService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.risksService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  create(@Body() dto: CreateRiskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.risksService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateRiskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.risksService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.risksService.remove(id, user);
  }
}
