import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Addon } from './entities/addon.entity';
import { CreateAddonDto, UpdateAddonDto } from './dto/addon.dto';
import { AuditActorType } from '../../common/enums';
import { AuthUser } from '../../common/decorators';
import { TenantConnectionService } from '../../database/tenant-connection.service';
import { AuditService } from '../identity/audit.service';
import { TenantAddon } from './entities/tenant-addon.entity';

@Injectable()
export class AddonsService {
  constructor(
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  findAll() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Addon).find({
        where: { isActive: true },
        order: { name: 'ASC' },
      }),
    );
  }

  findAllIncludingInactive() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Addon).find({
        order: { name: 'ASC' },
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantDb.withBypass(async (manager) => {
      const addon = await manager.getRepository(Addon).findOne({
        where: { id },
      });
      if (!addon) {
        throw new NotFoundException('Addon not found');
      }
      return addon;
    });
  }

  async create(dto: CreateAddonDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const addons = manager.getRepository(Addon);

      const addon = await addons.save(
        addons.create({
          moduleCode: dto.moduleCode,
          name: dto.name,
          description: dto.description ?? null,
          priceMonthly: dto.priceMonthly,
          priceYearly: dto.priceYearly ?? null,
          isActive: true,
        }),
      );

      await this.audit.log({
        action: 'addon.created',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'addon',
        entityId: addon.id,
        metadata: { moduleCode: dto.moduleCode, name: dto.name },
      });

      return addon;
    });
  }

  async update(id: string, dto: UpdateAddonDto, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const addons = manager.getRepository(Addon);
      const addon = await addons.findOne({ where: { id } });
      if (!addon) {
        throw new NotFoundException('Addon not found');
      }

      if (dto.name !== undefined) addon.name = dto.name;
      if (dto.description !== undefined) addon.description = dto.description;
      if (dto.priceMonthly !== undefined) addon.priceMonthly = dto.priceMonthly;
      if (dto.priceYearly !== undefined) addon.priceYearly = dto.priceYearly;
      if (dto.isActive !== undefined) addon.isActive = dto.isActive;

      await addons.save(addon);

      await this.audit.log({
        action: 'addon.updated',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'addon',
        entityId: addon.id,
      });

      return addon;
    });
  }

  async remove(id: string, actor: AuthUser) {
    return this.tenantDb.withBypass(async (manager) => {
      const addons = manager.getRepository(Addon);
      const tenantAddons = manager.getRepository(TenantAddon);

      const addon = await addons.findOne({ where: { id } });
      if (!addon) {
        throw new NotFoundException('Addon not found');
      }

      const activeSubscriptions = await tenantAddons.count({
        where: { addonId: id, status: 'ACTIVE' as never },
      });
      if (activeSubscriptions > 0) {
        throw new BadRequestException(
          `Cannot delete addon: ${activeSubscriptions} active subscription(s). Cancel them first.`,
        );
      }

      addon.isActive = false;
      await addons.save(addon);

      await this.audit.log({
        action: 'addon.deleted',
        actorType: AuditActorType.PLATFORM_USER,
        actorId: actor.sub,
        entityType: 'addon',
        entityId: addon.id,
      });

      return { id, deleted: true };
    });
  }
}
