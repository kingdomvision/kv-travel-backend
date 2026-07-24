import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AddonBillingCycle, AddonStatus } from '../../../common/enums';
import { Tenant } from './tenant.entity';
import { Addon } from './addon.entity';

@Entity({ name: 'tenant_addons' })
export class TenantAddon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.tenantAddons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'addon_id', type: 'uuid' })
  addonId!: string;

  @ManyToOne(() => Addon, (addon) => addon.tenantAddons, { eager: true })
  @JoinColumn({ name: 'addon_id' })
  addon!: Addon;

  @Column({
    type: 'enum',
    enum: AddonStatus,
    enumName: 'addon_status_enum',
    default: AddonStatus.ACTIVE,
  })
  status!: AddonStatus;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: AddonBillingCycle,
    enumName: 'addon_billing_cycle_enum',
  })
  billingCycle!: AddonBillingCycle;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
