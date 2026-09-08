import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateMethodologyVersionDto } from './dto/create-methodology-version.dto';
import { MethodologyService } from './methodology.service';

@Controller('methodology')
export class MethodologyController {
  constructor(private readonly methodologyService: MethodologyService) {}

  @Get('current')
  getCurrent() {
    return this.methodologyService.getCurrent();
  }

  @Get('history')
  getHistory() {
    return this.methodologyService.getHistory();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  createVersion(@Body() dto: CreateMethodologyVersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.methodologyService.createVersion(dto, user.id);
  }
}
