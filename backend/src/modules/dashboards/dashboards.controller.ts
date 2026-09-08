import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('executive')
  @Roles(UserRole.ADMIN, UserRole.EXECUTIVE)
  getExecutive(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getExecutiveTiles(user);
  }

  @Get('operational')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER, UserRole.AUDITOR)
  getOperational(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getOperationalTiles(user);
  }
}
