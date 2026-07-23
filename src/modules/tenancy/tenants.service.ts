import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { TenantUser } from './entities/tenant-user.entity';
import {
  CreateTenantDto,
  UpdateTenantProfileDto,
  UpdateTenantStatusDto,
} from './dto/tenant.dto';
import {
  AuditActorType,
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

  listPlans() {
    return this.tenantDb.withBypass((manager) =>
      manager.getRepository(Plan).find({
        where: { isActive: true },
        order: { name: 'ASC' },
      }),
    );
  }
}
