import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TravelModule } from '../../../common/enums';
import { TenantAddon } from './tenant-addon.entity';

@Entity({ name: 'addons' })
export class Addon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'module_code',
    type: 'enum',
    enum: TravelModule,
    enumName: 'travel_module_enum',
  })
  moduleCode!: TravelModule;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'price_monthly', type: 'int' })
  priceMonthly!: number;

  @Column({ name: 'price_yearly', type: 'int', nullable: true })
  priceYearly!: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TenantAddon, (ta) => ta.addon)
  tenantAddons!: TenantAddon[];
}
