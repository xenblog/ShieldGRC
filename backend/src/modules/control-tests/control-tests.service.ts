import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, TestResult } from '@prisma/client';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ControlsService } from '../controls/controls.service';
import {
  assertAllowedEvidenceFile,
  resolveEvidencePath,
  writeEvidenceFile,
} from '../../common/evidence/evidence-storage.util';
import { CreateControlTestDto } from './dto/create-control-test.dto';
import { UpdateControlTestDto } from './dto/update-control-test.dto';
import { QueryControlTestsDto } from './dto/query-control-tests.dto';

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function requiresExceptionNotes(result: TestResult): boolean {
  return result === TestResult.FAIL || result === TestResult.PARTIAL;
}

@Injectable()
export class ControlTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
    private readonly controlsService: ControlsService,
  ) {}

  private commonInclude() {
    return {
      control: { select: { id: true, code: true, name: true, orgUnitId: true } },
      tester: { select: { id: true, name: true, email: true } },
      evidence: true,
    } satisfies Prisma.ControlTestInclude;
  }

  async findAll(user: AuthenticatedUser, query: QueryControlTestsDto) {
    const controlWhere: Prisma.ControlWhereInput = this.scope.orgUnitWhere(user, query.orgUnitId);
    const tests = await this.prisma.controlTest.findMany({
      where: {
        result: query.result ?? undefined,
        testerId: query.testerId ?? undefined,
        cycle: query.cycle ?? undefined,
        controlId: query.controlId ?? undefined,
        control: controlWhere,
      },
      include: this.commonInclude(),
      orderBy: { testedDate: 'desc' },
    });
    return tests.map((t) => ({
      ...t,
      isDueSoon: t.dueDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 && t.dueDate.getTime() > Date.now(),
      isOverdue: t.dueDate.getTime() < Date.now(),
    }));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const test = await this.prisma.controlTest.findUnique({ where: { id }, include: this.commonInclude() });
    if (!test) throw new NotFoundException('Control test not found');
    this.scope.assertCanReadOrgUnit(user, test.control.orgUnitId);
    return test;
  }

  async create(dto: CreateControlTestDto, files: UploadedFileInput[], user: AuthenticatedUser) {
    const control = await this.prisma.control.findUnique({ where: { id: dto.controlId } });
    if (!control) throw new NotFoundException('Control not found');
    this.scope.assertCanWriteOrgUnit(user, control.orgUnitId);

    if (requiresExceptionNotes(dto.result) && !dto.exceptionNotes?.trim()) {
      throw new BadRequestException('Exception notes are required when the result is Fail or Partial');
    }

    for (const file of files) {
      assertAllowedEvidenceFile(file.originalname, file.mimetype, file.size);
    }

    const test = await this.prisma.$transaction(async (tx) => {
      const created = await tx.controlTest.create({
        data: {
          controlId: dto.controlId,
          result: dto.result,
          testMethod: dto.testMethod,
          testerId: dto.testerId,
          cycle: dto.cycle,
          testedDate: dto.testedDate,
          dueDate: dto.dueDate,
          exceptionNotes: dto.exceptionNotes,
        },
      });
      await this.controlsService.recomputeFromLatestTest(dto.controlId, tx);
      await this.audit.record(tx, {
        entityType: 'ControlTest',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    await this.attachEvidence(test.id, files, user.id);

    return this.findOne(test.id, user);
  }

  async update(id: string, dto: UpdateControlTestDto, files: UploadedFileInput[], user: AuthenticatedUser) {
    const existing = await this.prisma.controlTest.findUnique({ where: { id }, include: { control: true } });
    if (!existing) throw new NotFoundException('Control test not found');
    this.scope.assertCanWriteOrgUnit(user, existing.control.orgUnitId);

    const effectiveResult = dto.result ?? existing.result;
    if (requiresExceptionNotes(effectiveResult) && !(dto.exceptionNotes ?? existing.exceptionNotes)?.trim()) {
      throw new BadRequestException('Exception notes are required when the result is Fail or Partial');
    }

    for (const file of files) {
      assertAllowedEvidenceFile(file.originalname, file.mimetype, file.size);
    }

    // Evidence from a prior version of this test is never deleted here -
    // update only ever adds new Evidence rows (see writeEvidenceFile).
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.controlTest.update({
        where: { id },
        data: {
          result: dto.result,
          testMethod: dto.testMethod,
          testerId: dto.testerId,
          cycle: dto.cycle,
          testedDate: dto.testedDate,
          dueDate: dto.dueDate,
          exceptionNotes: dto.exceptionNotes,
        },
      });
      await this.controlsService.recomputeFromLatestTest(existing.controlId, tx);
      await this.audit.record(tx, {
        entityType: 'ControlTest',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
    });

    await this.attachEvidence(id, files, user.id);

    return this.findOne(id, user);
  }

  private async attachEvidence(controlTestId: string, files: UploadedFileInput[], uploadedById: string) {
    for (const file of files) {
      const storagePath = await writeEvidenceFile(controlTestId, file.originalname, file.buffer);
      await this.prisma.evidence.create({
        data: {
          controlTestId,
          filename: file.originalname,
          storagePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedById,
        },
      });
    }
  }

  async downloadEvidence(controlTestId: string, evidenceId: string, user: AuthenticatedUser) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { controlTest: { include: { control: true } } },
    });
    if (!evidence || evidence.controlTestId !== controlTestId) {
      throw new NotFoundException('Evidence not found');
    }
    this.scope.assertCanReadOrgUnit(user, evidence.controlTest.control.orgUnitId);

    const fullPath = resolveEvidencePath(evidence.storagePath);
    await fs.access(fullPath);
    return { stream: createReadStream(fullPath), evidence };
  }
}
