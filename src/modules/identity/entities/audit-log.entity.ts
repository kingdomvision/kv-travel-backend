import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditActorType } from '../../../common/enums';
import { Tenant } from '../../tenancy/entities/tenant.entity';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.auditLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant | null;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: AuditActorType,
    enumName: 'audit_actor_type_enum',
  })
  actorType!: AuditActorType;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column()
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
