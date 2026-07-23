import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DocumentEntity } from './entities/document.entity';
import { StorageService } from '../storage/storage.service';
import { DocumentStatus, AuditActorType } from '../../common/enums';
import { AuditService } from '../identity/audit.service';
import { AuthUser } from '../../common/decorators';
import { NOTIFICATION_QUEUE } from '../notifications/notification.constants';
import { TenantConnectionService } from '../../database/tenant-connection.service';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  /** Base64-encoded file body for Phase 1 simplicity */
  @IsString()
  @MinLength(1)
  @MaxLength(14_000_000)
  contentBase64!: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
    private readonly config: ConfigService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notifications: Queue,
  ) {}

  list(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, (manager) =>
      manager.getRepository(DocumentEntity).find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async create(tenantId: string, dto: CreateDocumentDto, actor: AuthUser) {
    const maxBytes =
      this.config.get<number>('app.uploads.maxBytes') ?? 10 * 1024 * 1024;
    const allowed =
      this.config.get<string[]>('app.uploads.allowedContentTypes') ?? [];

    if (!allowed.includes(dto.contentType)) {
      throw new BadRequestException(
        `Content type not allowed. Allowed: ${allowed.join(', ')}`,
      );
    }

    let body: Buffer;
    try {
      body = Buffer.from(dto.contentBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 content');
    }

    if (body.length === 0) {
      throw new BadRequestException('Empty file content');
    }
    if (body.length > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds maximum size of ${maxBytes} bytes`,
      );
    }
    if (dto.sizeBytes !== body.length) {
      throw new BadRequestException('sizeBytes does not match decoded content length');
    }

    const key = this.storage.buildKey(tenantId, dto.fileName);
    await this.storage.putObject({
      key,
      body,
      contentType: dto.contentType,
    });

    return this.tenantDb.withTenant(tenantId, async (manager) => {
      const documents = manager.getRepository(DocumentEntity);
      const doc = await documents.save(
        documents.create({
          tenantId,
          uploadedById: actor.sub,
          fileName: dto.fileName,
          contentType: dto.contentType,
          sizeBytes: body.length,
          storageKey: key,
          status: DocumentStatus.PROCESSING,
        }),
      );

      await this.notifications.add('document.uploaded', {
        tenantId,
        documentId: doc.id,
        fileName: doc.fileName,
      });

      await this.audit.log({
        action: 'document.uploaded',
        actorType: AuditActorType.TENANT_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'document',
        entityId: doc.id,
      });

      return doc;
    });
  }

  async getDownloadUrl(tenantId: string, id: string) {
    return this.tenantDb.withTenant(tenantId, async (manager) => {
      const doc = await manager.getRepository(DocumentEntity).findOne({
        where: { id, tenantId },
      });
      if (!doc) {
        throw new NotFoundException('Document not found');
      }
      const url = await this.storage.getSignedDownloadUrl(doc.storageKey);
      return { id: doc.id, fileName: doc.fileName, url };
    });
  }
}
