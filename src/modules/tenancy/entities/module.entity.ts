import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TravelModule } from '../../../common/enums';
import { PlanModule } from './plan-module.entity';
import { TenantModule } from './tenant-module.entity';

@Entity({ name: 'modules' })
export class Module {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: TravelModule,
    enumName: 'travel_module_enum',
    unique: true,
  })
  code!: TravelModule;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ default: 'travel' })
  category!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PlanModule, (pm) => pm.module)
  planModules!: PlanModule[];

  @OneToMany(() => TenantModule, (tm) => tm.module)
  tenantModules!: TenantModule[];
}
