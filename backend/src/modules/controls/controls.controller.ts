import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateControlDto } from './dto/create-control.dto';
import { UpdateControlDto } from './dto/update-control.dto';
import { QueryControlsDto } from './dto/query-controls.dto';
import { ControlsService } from './controls.service';

@Controller('controls')
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryControlsDto) {
    return this.controlsService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.controlsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  create(@Body() dto: CreateControlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.controlsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateControlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.controlsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.controlsService.remove(id, user);
  }
}
