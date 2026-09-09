import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMethodologyVersionDto } from './dto/create-methodology-version.dto';

@Injectable()
export class MethodologyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent() {
    const current = await this.prisma.methodologyVersion.findFirst({
      where: { isCurrent: true },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!current) throw new NotFoundException('No methodology version has been published yet');
    return current;
  }

  getHistory() {
    return this.prisma.methodologyVersion.findMany({
      orderBy: { version: 'desc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async createVersion(dto: CreateMethodologyVersionDto, authorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.methodologyVersion.findFirst({ orderBy: { version: 'desc' } });
      await tx.methodologyVersion.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      return tx.methodologyVersion.create({
        data: {
          version: (last?.version ?? 0) + 1,
          frameworkReference: dto.frameworkReference,
          contentHtml: dto.contentHtml,
          isCurrent: true,
          authorId,
        },
        include: { author: { select: { id: true, name: true, email: true } } },
      });
    });
  }
}
