import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateFrameworkDto, UpdateFrameworkDto } from './dto/framework.dto';
import { FrameworksService } from './frameworks.service';

@Controller('frameworks')
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('orgUnitId') orgUnitId?: string) {
    return this.frameworksService.findAll(user, { orgUnitId });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworksService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateFrameworkDto, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworksService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFrameworkDto, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworksService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworksService.remove(id, user);
  }
}
