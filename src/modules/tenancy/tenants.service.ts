import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { PlanModule } from './entities/plan-module.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantModule } from './entities/tenant-module.entity';
import {
  CreateTenantDto,
  UpdateTenantProfileDto,
  UpdateTenantStatusDto,
} from './dto/tenant.dto';
import { ChangeTenantPlanDto } from './dto/tenant-module.dto';
import {
  AuditActorType,
  ModuleSource,
  TenantModuleStatus,
  TenantRole,
  TenantStatus,
} from '../../common/enums';
import { AuditService } from '../identity/audit.service';
import { AuthUser } from '../../common/decorators';
import { TenantConnectionService } from '../../database/tenant-connection.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  findAll() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Tenant).find({
        relations: { plan: true },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenant = await manager.getRepository(Tenant).findOne({
        where: { id },
        relations: { plan: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      return tenant;
    });
  }

  async findOneWithModules(id: string) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenant = await manager.getRepository(Tenant).findOne({
        where: { id },
        relations: {
          plan: { planModules: { module: true } },
          tenantModules: { module: true },
          tenantAddons: { addon: true },
        },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      return tenant;
    });
  }

  async create(dto: CreateTenantDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenants = manager.getRepository(Tenant);
      const plans = manager.getRepository(Plan);
      const tenantUsers = manager.getRepository(TenantUser);

      const existing = await tenants.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new BadRequestException('Slug already in use');
      }

      let plan: Plan | null = null;
      if (dto.planId) {
        plan = await plans.findOne({ where: { id: dto.planId } });
        if (!plan) {
          throw new BadRequestException('Plan not found');
        }
      } else {
        plan = await plans.findOne({ where: { code: 'starter' } });
      }

      const tenant = await tenants.save(
        tenants.create({
          name: dto.name,
          slug: dto.slug,
          status: TenantStatus.ACTIVE,
          planId: plan?.id ?? null,
          legalName: dto.legalName ?? null,
          countryCode: dto.countryCode ?? null,
          timezone: dto.timezone ?? 'UTC',
        }),
      );

      // Sync tenant_modules from plan
      if (plan) {
        await this.syncModulesFromPlan(manager, tenant.id, plan.id);
      }

      if (dto.adminEmail && dto.adminPassword && dto.adminFullName) {
        await tenantUsers.save(
          tenantUsers.create({
            tenantId: tenant.id,
            email: dto.adminEmail,
            fullName: dto.adminFullName,
            passwordHash: await bcrypt.hash(dto.adminPassword, 12),
            role: TenantRole.TENANT_ADMIN,
          }),
        );
      }

      await this.audit.log({
        action: 'tenant.created',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        tenantId: tenant.id,
        entityType: 'tenant',
        entityId: tenant.id,
        metadata: { slug: tenant.slug },
      });

      const created = await tenants.findOne({
        where: { id: tenant.id },
        relations: { plan: true },
      });
      if (!created) {
        throw new NotFoundException('Tenant not found');
      }
      return created;
    });
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenants = manager.getRepository(Tenant);
      const tenant = await tenants.findOne({
        where: { id },
        relations: { plan: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      tenant.status = dto.status;
      await tenants.save(tenant);
      await this.audit.log({
        action: `tenant.status.${dto.status.toLowerCase()}`,
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        tenantId: tenant.id,
        entityType: 'tenant',
        entityId: tenant.id,
      });
      return tenant;
    });
  }

  async updateProfile(
    tenantId: string,
    dto: UpdateTenantProfileDto,
    actor: AuthUser,
  ) {
    return this.tenantDb.withTenant(tenantId, async (manager) => {
      const tenants = manager.getRepository(Tenant);
      const tenant = await tenants.findOne({
        where: { id: tenantId },
        relations: { plan: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      if (dto.name !== undefined) tenant.name = dto.name;
      if (dto.legalName !== undefined) tenant.legalName = dto.legalName;
      if (dto.countryCode !== undefined) tenant.countryCode = dto.countryCode;
      if (dto.timezone !== undefined) tenant.timezone = dto.timezone;
      await tenants.save(tenant);
      await this.audit.log({
        action: 'tenant.profile.updated',
        actorType: AuditActorType.TENANT_USER,
        actorId: actor.sub,
        tenantId: tenant.id,
        entityType: 'tenant',
        entityId: tenant.id,
      });
      return tenant;
    });
  }

  async changePlan(
    tenantId: string,
    dto: ChangeTenantPlanDto,
    actor: AuthUser,
  ) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenants = manager.getRepository(Tenant);
      const plans = manager.getRepository(Plan);

      const tenant = await tenants.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const newPlan = await plans.findOne({ where: { id: dto.planId } });
      if (!newPlan) {
        throw new BadRequestException('Plan not found');
      }

      tenant.planId = dto.planId;
      await tenants.save(tenant);

      // Re-sync modules from new plan (preserving addon-sourced modules)
      await this.syncModulesFromPlan(manager, tenantId, dto.planId);

      await this.audit.log({
        action: 'tenant.plan.changed',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'tenant',
        entityId: tenantId,
        metadata: {
          previousPlanId: tenant.planId,
          newPlanId: dto.planId,
          newPlanCode: newPlan.code,
        },
      });

      return this.findOneWithModules(tenantId);
    });
  }

  listPlans() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Plan).find({
        where: { isActive: true },
        relations: { planModules: { module: true } },
        order: { name: 'ASC' },
      }),
    );
  }

  private async syncModulesFromPlan(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    planId: string,
  ) {
    const planModules = manager.getRepository(PlanModule);
    const tenantModules = manager.getRepository(TenantModule);

    const planModulesList = await planModules.find({
      where: { planId },
    });
    const planModuleCodes = new Set(planModulesList.map((pm) => pm.moduleCode));

    // Get existing tenant modules
    const existingModules = await tenantModules.find({
      where: { tenantId },
    });

    // Remove plan-sourced modules that are no longer in the plan
    for (const tm of existingModules) {
      if (
        tm.source === ModuleSource.PLAN &&
        !planModuleCodes.has(tm.moduleCode)
      ) {
        await tenantModules.remove(tm);
      }
    }

    // Add or update plan-sourced modules
    for (const pm of planModulesList) {
      const existing = await tenantModules.findOne({
        where: {
          tenantId,
          moduleCode: pm.moduleCode,
          source: ModuleSource.PLAN,
        },
      });

      if (existing) {
        existing.status = TenantModuleStatus.ACTIVE;
        existing.metadata = { limits: pm.limits };
        await tenantModules.save(existing);
      } else {
        // Only create if no addon-sourced module exists for same code
        const addonModule = await tenantModules.findOne({
          where: {
            tenantId,
            moduleCode: pm.moduleCode,
            source: ModuleSource.ADDON,
          },
        });
        if (!addonModule) {
          await tenantModules.save(
            tenantModules.create({
              tenantId,
              moduleCode: pm.moduleCode,
              source: ModuleSource.PLAN,
              status: TenantModuleStatus.ACTIVE,
              metadata: { limits: pm.limits },
            }),
          );
        }
      }
    }
  }
}
