import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from './notification.constants';
import { DocumentEntity } from '../documents/entities/document.entity';
import { DocumentStatus } from '../../common/enums';
import { TenantConnectionService } from '../../database/tenant-connection.service';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    private readonly tenantDb: TenantConnectionService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} (${job.id})`);

    if (job.name === 'document.uploaded') {
      const documentId = job.data.documentId as string;
      const doc = await this.tenantDb.withBypass(async (manager) => {
        const repo = manager.getRepository(DocumentEntity);
        return repo.findOne({ where: { id: documentId } });
      });
      if (doc) {
        await this.tenantDb.withBypass(async (manager) => {
          const repo = manager.getRepository(DocumentEntity);
          doc.status = DocumentStatus.READY;
          await repo.save(doc);
        });
      }
      this.logger.log(
        `Stub notification: document ${documentId} ready for tenant ${job.data.tenantId}`,
      );
    }

    if (job.name === 'email.send') {
      this.logger.log(`Stub email to ${job.data.to}: ${job.data.subject}`);
    }
  }
}
