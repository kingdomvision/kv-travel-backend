import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { PlanModule } from './entities/plan-module.entity';
import {
  AssignPlanModuleDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { AuditActorType, TenantStatus } from '../../common/enums';
import { AuthUser } from '../../common/decorators';
import { TenantConnectionService } from '../../database/tenant-connection.service';
import { AuditService } from '../identity/audit.service';

@Injectable()
export class PlansService {
  constructor(
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  findAll() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Plan).find({
        relations: { planModules: { module: true } },
        order: { name: 'ASC' },
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantDb.withBypass(async (manager) => {
      const plan = await manager.getRepository(Plan).findOne({
        where: { id },
        relations: { planModules: { module: true }, tenants: false },
      });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
      return plan;
    });
  }

  async create(dto: CreatePlanDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const plans = manager.getRepository(Plan);

      const existing = await plans.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException('Plan code already in use');
      }

      const plan = await plans.save(
        plans.create({
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          maxUsers: dto.maxUsers ?? 10,
          priceMonthly: dto.priceMonthly ?? null,
          priceYearly: dto.priceYearly ?? null,
          isActive: true,
        }),
      );

      if (dto.modules?.length) {
        const planModules = manager.getRepository(PlanModule);
        await planModules.save(
          dto.modules.map((m) =>
            planModules.create({
              planId: plan.id,
              moduleCode: m.moduleCode,
              limits: m.limits ?? null,
            }),
          ),
        );
      }

      await this.audit.log({
        action: 'plan.created',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'plan',
        entityId: plan.id,
        metadata: { code: plan.code, name: plan.name },
      });

      return this.findOne(plan.id);
    });
  }

  async update(id: string, dto: UpdatePlanDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const plans = manager.getRepository(Plan);
      const plan = await plans.findOne({ where: { id } });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      if (dto.name !== undefined) plan.name = dto.name;
      if (dto.description !== undefined) plan.description = dto.description;
      if (dto.maxUsers !== undefined) plan.maxUsers = dto.maxUsers;
      if (dto.priceMonthly !== undefined) plan.priceMonthly = dto.priceMonthly;
      if (dto.priceYearly !== undefined) plan.priceYearly = dto.priceYearly;
      if (dto.isActive !== undefined) plan.isActive = dto.isActive;

      await plans.save(plan);

      if (dto.modules !== undefined) {
        const planModules = manager.getRepository(PlanModule);

        // Remove existing modules not in the new list
        const newCodes = new Set(dto.modules.map((m) => m.moduleCode));
        const existing = await planModules.find({
          where: { planId: id },
        });
        for (const em of existing) {
          if (!newCodes.has(em.moduleCode)) {
            await planModules.remove(em);
          }
        }

        // Upsert new modules
        for (const m of dto.modules) {
          const existingModule = await planModules.findOne({
            where: { planId: id, moduleCode: m.moduleCode },
          });
          if (existingModule) {
            existingModule.limits = m.limits ?? null;
            await planModules.save(existingModule);
          } else {
            await planModules.save(
              planModules.create({
                planId: id,
                moduleCode: m.moduleCode,
                limits: m.limits ?? null,
              }),
            );
          }
        }
      }

      await this.audit.log({
        action: 'plan.updated',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'plan',
        entityId: plan.id,
      });

      return this.findOne(id);
    });
  }

  async remove(id: string, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const plans = manager.getRepository(Plan);
      const tenants = manager.getRepository(Tenant);
      const plan = await plans.findOne({ where: { id } });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      const activeTenants = await tenants.count({
        where: { planId: id, status: TenantStatus.ACTIVE },
      });
      if (activeTenants > 0) {
        throw new BadRequestException(
          `Cannot delete plan: ${activeTenants} active tenant(s) still assigned. Reassign them first.`,
        );
      }

      plan.isActive = false;
      await plans.save(plan);

      await this.audit.log({
        action: 'plan.deleted',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'plan',
        entityId: plan.id,
      });

      return { id, deleted: true };
    });
  }

  async assignModule(
    planId: string,
    dto: AssignPlanModuleDto,
    actor: AuthUser,
  ) {
    return this.tenantDb.withBypass(async (manager) => {
      const plans = manager.getRepository(Plan);
      const planModules = manager.getRepository(PlanModule);

      const plan = await plans.findOne({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      const existing = await planModules.findOne({
        where: { planId, moduleCode: dto.moduleCode },
      });
      if (existing) {
        throw new BadRequestException(
          'Module already assigned to this plan. Use update to modify limits.',
        );
      }

      await planModules.save(
        planModules.create({
          planId,
          moduleCode: dto.moduleCode,
          limits: dto.limits ?? null,
        }),
      );

      await this.audit.log({
        action: 'plan.module.assigned',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'plan',
        entityId: planId,
        metadata: { moduleCode: dto.moduleCode },
      });

      return this.findOne(planId);
    });
  }

  async removeModule(planId: string, moduleCode: string, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const planModules = manager.getRepository(PlanModule);

      const existing = await planModules.findOne({
        where: { planId, moduleCode: moduleCode as never },
      });
      if (!existing) {
        throw new NotFoundException('Module not found on this plan');
      }

      await planModules.remove(existing);

      await this.audit.log({
        action: 'plan.module.removed',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'plan',
        entityId: planId,
        metadata: { moduleCode },
      });

      return this.findOne(planId);
    });
  }
}
