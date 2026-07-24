import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddonBillingCycle,
  AddonStatus,
  AuditActorType,
  ModuleSource,
  TenantModuleStatus,
} from '../../common/enums';
import { PurchaseAddonDto } from './dto/addon.dto';
import { AuthUser } from '../../common/decorators';
import { TenantConnectionService } from '../../database/tenant-connection.service';
import { AuditService } from '../identity/audit.service';
import { TenantAddon } from './entities/tenant-addon.entity';
import { TenantModule } from './entities/tenant-module.entity';
import { Addon } from './entities/addon.entity';

@Injectable()
export class TenantAddonsService {
  constructor(
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  listForTenant(tenantId: string) {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(TenantAddon).find({
        where: { tenantId },
        relations: { addon: true },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async purchase(tenantId: string, dto: PurchaseAddonDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenantAddons = manager.getRepository(TenantAddon);
      const tenantModules = manager.getRepository(TenantModule);
      const addons = manager.getRepository(Addon);

      const addon = await addons.findOne({ where: { id: dto.addonId } });
      if (!addon || !addon.isActive) {
        throw new NotFoundException('Addon not found or inactive');
      }

      const existing = await tenantAddons.findOne({
        where: { tenantId, addonId: dto.addonId, status: AddonStatus.ACTIVE },
      });
      if (existing) {
        throw new BadRequestException(
          'Tenant already has an active subscription for this addon',
        );
      }

      const now = new Date();
      const expiresAt =
        dto.billingCycle === AddonBillingCycle.MONTHLY
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const tenantAddon = await tenantAddons.save(
        tenantAddons.create({
          tenantId,
          addonId: dto.addonId,
          status: AddonStatus.ACTIVE,
          billingCycle: dto.billingCycle,
          startsAt: now,
          expiresAt,
        }),
      );

      // Add or reactivate tenant module with ADDON source
      const existingModule = await tenantModules.findOne({
        where: { tenantId, moduleCode: addon.moduleCode as never },
      });

      if (existingModule) {
        // Module exists — upgrade source if it was only from plan
        existingModule.source = ModuleSource.ADDON;
        existingModule.status = TenantModuleStatus.ACTIVE;
        existingModule.expiresAt = expiresAt;
        existingModule.metadata = {
          ...(existingModule.metadata ?? {}),
          addonId: dto.addonId,
        };
        await tenantModules.save(existingModule);
      } else {
        await tenantModules.save(
          tenantModules.create({
            tenantId,
            moduleCode: addon.moduleCode,
            source: ModuleSource.ADDON,
            status: TenantModuleStatus.ACTIVE,
            expiresAt,
            metadata: { addonId: dto.addonId },
          }),
        );
      }

      await this.audit.log({
        action: 'tenant.addon.purchased',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'tenant_addon',
        entityId: tenantAddon.id,
        metadata: {
          addonId: dto.addonId,
          moduleCode: addon.moduleCode,
          billingCycle: dto.billingCycle,
        },
      });

      return tenantAddon;
    });
  }

  async cancel(tenantId: string, addonId: string, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const tenantAddons = manager.getRepository(TenantAddon);
      const tenantModules = manager.getRepository(TenantModule);

      const subscription = await tenantAddons.findOne({
        where: { tenantId, addonId, status: AddonStatus.ACTIVE },
        relations: { addon: true },
      });
      if (!subscription) {
        throw new NotFoundException(
          'Active subscription not found for this addon',
        );
      }

      subscription.status = AddonStatus.CANCELLED;
      subscription.expiresAt = new Date();
      await tenantAddons.save(subscription);

      // Remove addon-sourced tenant module
      const tenantModule = await tenantModules.findOne({
        where: {
          tenantId,
          moduleCode: subscription.addon.moduleCode as never,
          source: ModuleSource.ADDON,
        },
      });
      if (tenantModule) {
        await tenantModules.remove(tenantModule);
      }

      await this.audit.log({
        action: 'tenant.addon.cancelled',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'tenant_addon',
        entityId: subscription.id,
        metadata: {
          addonId,
          moduleCode: subscription.addon.moduleCode,
        },
      });

      return { id: subscription.id, cancelled: true };
    });
  }

  listForTenantModules(tenantId: string) {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(TenantModule).find({
        where: { tenantId },
        relations: { module: true },
        order: { createdAt: 'ASC' },
      }),
    );
  }
}
