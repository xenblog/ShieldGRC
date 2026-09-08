import { Module } from '@nestjs/common';
import { MethodologyController } from './methodology.controller';
import { MethodologyService } from './methodology.service';

@Module({
  controllers: [MethodologyController],
  providers: [MethodologyService],
})
export class MethodologyModule {}
