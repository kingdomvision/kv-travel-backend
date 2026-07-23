import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../../../common/enums';
import { Tenant } from '../../tenancy/entities/tenant.entity';

@Entity({ name: 'documents' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById!: string | null;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'content_type' })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @Column({ name: 'storage_key' })
  storageKey!: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    enumName: 'document_status_enum',
    default: DocumentStatus.UPLOADED,
  })
  status!: DocumentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
