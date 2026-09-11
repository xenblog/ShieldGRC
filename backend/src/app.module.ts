import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { PrismaModule } from './common/prisma/prisma.module';
import { OrgUnitScopeModule } from './common/org-unit-scope/org-unit-scope.module';
import { AssessmentProgressModule } from './common/assessment-progress/assessment-progress.module';
import { ResidualScoringModule } from './common/scoring/residual-scoring.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OverdueStatusTask } from './common/scheduler/overdue-status.task';
import { validateEnv } from './common/config/env.validation';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgUnitsModule } from './modules/org-units/org-units.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { RisksModule } from './modules/risks/risks.module';
import { RiskAssessmentsModule } from './modules/risk-assessments/risk-assessments.module';
import { TreatmentActionsModule } from './modules/treatment-actions/treatment-actions.module';
import { MethodologyModule } from './modules/methodology/methodology.module';
import { ControlsModule } from './modules/controls/controls.module';
import { ControlTestsModule } from './modules/control-tests/control-tests.module';
import { FrameworksModule } from './modules/frameworks/frameworks.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { BusinessProcessesModule } from './modules/business-processes/business-processes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: true,
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    OrgUnitScopeModule,
    AssessmentProgressModule,
    ResidualScoringModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrgUnitsModule,
    CategoriesModule,
    RisksModule,
    RiskAssessmentsModule,
    TreatmentActionsModule,
    MethodologyModule,
    ControlsModule,
    ControlTestsModule,
    FrameworksModule,
    DashboardsModule,
    BusinessProcessesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    OverdueStatusTask,
  ],
})
export class AppModule {}
