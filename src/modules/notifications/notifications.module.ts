import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATION_QUEUE } from './notification.constants';
import { DocumentEntity } from '../documents/entities/document.entity';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    DatabaseModule,
  ],
  providers: [NotificationProcessor],
})
export class NotificationsModule {}
