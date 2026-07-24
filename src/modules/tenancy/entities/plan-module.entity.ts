import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TravelModule } from '../../../common/enums';
import { Plan } from './plan.entity';
import { Module } from './module.entity';

@Entity({ name: 'plan_modules' })
export class PlanModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, (plan) => plan.planModules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  @Column({
    name: 'module_code',
    type: 'enum',
    enum: TravelModule,
    enumName: 'travel_module_enum',
  })
  moduleCode!: TravelModule;

  @ManyToOne(() => Module, (module) => module.planModules, { eager: true })
  @JoinColumn({ name: 'module_code', referencedColumnName: 'code' })
  module!: Module;

  @Column({ type: 'jsonb', nullable: true })
  limits!: Record<string, unknown> | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
