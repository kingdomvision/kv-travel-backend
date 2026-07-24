import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from '../../../common/enums';
import { Plan } from './plan.entity';
import { TenantUser } from './tenant-user.entity';
import { TenantModule } from './tenant-module.entity';
import { TenantAddon } from './tenant-addon.entity';
import { DocumentEntity } from '../../documents/entities/document.entity';
import { AuditLog } from '../../identity/entities/audit-log.entity';

@Entity({ name: 'tenants' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string;

  @Column()
  name!: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    enumName: 'tenant_status_enum',
    default: TenantStatus.PENDING,
  })
  status!: TenantStatus;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @ManyToOne(() => Plan, (plan) => plan.tenants, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan | null;

  @Column({ name: 'legal_name', type: 'varchar', nullable: true })
  legalName!: string | null;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ default: 'UTC' })
  timezone!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TenantUser, (user) => user.tenant)
  users!: TenantUser[];

  @OneToMany(() => TenantModule, (tm) => tm.tenant)
  tenantModules!: TenantModule[];

  @OneToMany(() => TenantAddon, (ta) => ta.tenant)
  tenantAddons!: TenantAddon[];

  @OneToMany(() => DocumentEntity, (doc) => doc.tenant)
  documents!: DocumentEntity[];

  @OneToMany(() => AuditLog, (log) => log.tenant)
  auditLogs!: AuditLog[];
}
