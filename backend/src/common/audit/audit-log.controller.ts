import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@Roles(UserRole.ADMIN)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.auditService.findAll({
      entityType,
      entityId,
      actorId,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}
