import { Global, Module } from '@nestjs/common';
import { OrgUnitScopeService } from './org-unit-scope.service';

@Global()
@Module({
  providers: [OrgUnitScopeService],
  exports: [OrgUnitScopeService],
})
export class OrgUnitScopeModule {}
