import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ModuleSource,
  TenantModuleStatus,
  TravelModule,
} from '../../../common/enums';
import { Tenant } from './tenant.entity';
import { Module } from './module.entity';

@Entity({ name: 'tenant_modules' })
export class TenantModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.tenantModules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({
    name: 'module_code',
    type: 'enum',
    enum: TravelModule,
    enumName: 'travel_module_enum',
  })
  moduleCode!: TravelModule;

  @ManyToOne(() => Module, (module) => module.tenantModules, { eager: true })
  @JoinColumn({ name: 'module_code', referencedColumnName: 'code' })
  module!: Module;

  @Column({
    type: 'enum',
    enum: ModuleSource,
    enumName: 'module_source_enum',
  })
  source!: ModuleSource;

  @Column({
    type: 'enum',
    enum: TenantModuleStatus,
    enumName: 'tenant_module_status_enum',
    default: TenantModuleStatus.ACTIVE,
  })
  status!: TenantModuleStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
