import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { EVIDENCE_MAX_SIZE_BYTES } from '../../common/evidence/evidence-storage.util';
import { CreateControlTestDto } from './dto/create-control-test.dto';
import { UpdateControlTestDto } from './dto/update-control-test.dto';
import { QueryControlTestsDto } from './dto/query-control-tests.dto';
import { ControlTestsService } from './control-tests.service';

const MAX_FILES_PER_UPLOAD = 10;
const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_SIZE_BYTES, files: MAX_FILES_PER_UPLOAD },
};

@Controller('control-tests')
export class ControlTestsController {
  constructor(private readonly controlTestsService: ControlTestsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryControlTestsDto) {
    return this.controlTestsService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.controlTestsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  @UseInterceptors(FilesInterceptor('evidence', MAX_FILES_PER_UPLOAD, uploadOptions))
  create(
    @Body() dto: CreateControlTestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.controlTestsService.create(dto, files ?? [], user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RISK_OWNER)
  @UseInterceptors(FilesInterceptor('evidence', MAX_FILES_PER_UPLOAD, uploadOptions))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateControlTestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.controlTestsService.update(id, dto, files ?? [], user);
  }

  @Get(':id/evidence/:evidenceId/download')
  async download(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, evidence } = await this.controlTestsService.downloadEvidence(id, evidenceId, user);
    res.set({
      'Content-Type': evidence.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(evidence.filename)}"`,
    });
    return new StreamableFile(stream);
  }
}
