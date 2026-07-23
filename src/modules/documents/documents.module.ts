import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DocumentEntity } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { NOTIFICATION_QUEUE } from '../notifications/notification.constants';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    StorageModule,
    IdentityModule,
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService, TypeOrmModule],
})
export class DocumentsModule {}
