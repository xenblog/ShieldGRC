import { Module } from '@nestjs/common';
import { FrameworkControlsController } from './framework-controls.controller';
import { FrameworkControlsService } from './framework-controls.service';

@Module({
  controllers: [FrameworkControlsController],
  providers: [FrameworkControlsService],
  exports: [FrameworkControlsService],
})
export class FrameworkControlsModule {}
