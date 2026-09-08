import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrgUnitDto, UpdateOrgUnitDto } from './dto/org-unit.dto';
import { OrgUnitsService } from './org-units.service';

@Controller('org-units')
export class OrgUnitsController {
  constructor(private readonly orgUnitsService: OrgUnitsService) {}

  @Get()
  findAll() {
    return this.orgUnitsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgUnitsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateOrgUnitDto) {
    return this.orgUnitsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto) {
    return this.orgUnitsService.update(id, dto);
  }
}
