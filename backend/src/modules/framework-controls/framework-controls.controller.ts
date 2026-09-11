import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateFrameworkControlDto, UpdateFrameworkControlDto } from './dto/framework-control.dto';
import { FrameworkControlsService } from './framework-controls.service';

@Controller('framework-controls')
export class FrameworkControlsController {
  constructor(private readonly frameworkControlsService: FrameworkControlsService) {}

  @Get()
  findAll(@Query('frameworkId') frameworkId?: string) {
    return this.frameworkControlsService.findAll({ frameworkId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.frameworkControlsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateFrameworkControlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworkControlsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFrameworkControlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworkControlsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.frameworkControlsService.remove(id, user);
  }
}
