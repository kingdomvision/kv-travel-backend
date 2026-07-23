import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TenantUser } from './entities/tenant-user.entity';
import { AuditActorType, TenantRole } from '../../common/enums';
import { AuditService } from '../identity/audit.service';
import { AuthUser } from '../../common/decorators';
import { TenantsService } from './tenants.service';
import { TenantConnectionService } from '../../database/tenant-connection.service';

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(TenantRole)
  role?: TenantRole;
}

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(TenantRole)
  role?: TenantRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly tenants: TenantsService,
    private readonly audit: AuditService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async list(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, (manager) =>
      manager.getRepository(TenantUser).find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          tenantId: true,
        },
      }),
    );
  }

  async create(tenantId: string, dto: CreateTenantUserDto, actor: AuthUser) {
    await this.tenants.findOne(tenantId);
    return this.tenantDb.withTenant(tenantId, async (manager) => {
      const users = manager.getRepository(TenantUser);
      const existing = await users.findOne({
        where: { tenantId, email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('Email already exists for this tenant');
      }
      const user = await users.save(
        users.create({
          tenantId,
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: dto.role ?? TenantRole.AGENT,
        }),
      );
      await this.audit.log({
        action: 'tenant_user.created',
        actorType: AuditActorType.TENANT_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'tenant_user',
        entityId: user.id,
      });
      const { passwordHash: _, ...safe } = user;
      return safe;
    });
  }

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateTenantUserDto,
    actor: AuthUser,
  ) {
    return this.tenantDb.withTenant(tenantId, async (manager) => {
      const users = manager.getRepository(TenantUser);
      const user = await users.findOne({ where: { id: userId, tenantId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (dto.fullName !== undefined) user.fullName = dto.fullName;
      if (dto.role !== undefined) user.role = dto.role;
      if (dto.isActive !== undefined) user.isActive = dto.isActive;
      await users.save(user);
      await this.audit.log({
        action: 'tenant_user.updated',
        actorType: AuditActorType.TENANT_USER,
        actorId: actor.sub,
        tenantId,
        entityType: 'tenant_user',
        entityId: user.id,
      });
      const { passwordHash: _, ...safe } = user;
      return safe;
    });
  }
}
