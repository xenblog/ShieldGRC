import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrgUnitDto, UpdateOrgUnitDto } from './dto/org-unit.dto';

@Injectable()
export class OrgUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.orgUnit.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const orgUnit = await this.prisma.orgUnit.findUnique({ where: { id } });
    if (!orgUnit) throw new NotFoundException('Org unit not found');
    return orgUnit;
  }

  create(dto: CreateOrgUnitDto) {
    return this.prisma.orgUnit.create({ data: dto });
  }

  async update(id: string, dto: UpdateOrgUnitDto) {
    await this.findOne(id);
    return this.prisma.orgUnit.update({ where: { id }, data: dto });
  }
}
