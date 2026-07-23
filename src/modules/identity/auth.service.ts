import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PlatformUser } from './entities/platform-user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { TenantUser } from '../tenancy/entities/tenant-user.entity';
import { Tenant } from '../tenancy/entities/tenant.entity';
import { TokenAudience, TenantStatus } from '../../common/enums';
import { LoginDto } from './dto/login.dto';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { TenantConnectionService } from '../../database/tenant-connection.service';
import { ttlToMs } from '../../common/ttl';

export type DiscoverOrganization = {
  tenantId: string;
  name: string;
  slug: string;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    role: string;
    audience: TokenAudience;
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PlatformUser)
    private readonly platformUsers: Repository<PlatformUser>,
    @InjectRepository(TenantUser)
    private readonly tenantUsers: Repository<TenantUser>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async loginPlatform(dto: LoginDto): Promise<IssuedTokens> {
    return this.tenantDb.withBypass(async (manager) => {
      const user = await manager.getRepository(PlatformUser).findOne({
        where: { email: dto.email },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.issueTokens(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          audience: TokenAudience.PLATFORM,
        },
        manager,
      );
    });
  }

  /**
   * Email-first org lookup. Always returns 200 with a list (may be empty)
   * so the UI can show a friendly next step without leaking account existence loudly.
   */
  async discoverTenantOrganizations(email: string): Promise<{
    organizations: DiscoverOrganization[];
  }> {
    const normalized = email.trim().toLowerCase();
    return this.tenantDb.withBypass(async (manager) => {
      const users = await manager
        .getRepository(TenantUser)
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.tenant', 'tenant')
        .where('LOWER(user.email) = :email', { email: normalized })
        .andWhere('user.isActive = true')
        .andWhere('tenant.status != :suspended', {
          suspended: TenantStatus.SUSPENDED,
        })
        .orderBy('tenant.name', 'ASC')
        .getMany();

      return {
        organizations:
          users.length === 0
            ? []
            : users.map((user) => ({
                tenantId: user.tenant.id,
                name: user.tenant.name,
                slug: user.tenant.slug,
              })),
      };
    });
  }

  async loginTenant(dto: TenantLoginDto): Promise<IssuedTokens> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    return this.tenantDb.withBypass(async (manager) => {
      let tenant: Tenant | null = null;
      const tenants = manager.getRepository(Tenant);
      const tenantUsers = manager.getRepository(TenantUser);

      if (dto.tenantId) {
        tenant = await tenants.findOne({ where: { id: dto.tenantId } });
      } else if (dto.tenantSlug) {
        tenant = await tenants.findOne({ where: { slug: dto.tenantSlug } });
      } else {
        const matches = await tenantUsers
          .createQueryBuilder('user')
          .innerJoinAndSelect('user.tenant', 'tenant')
          .where('LOWER(user.email) = :email', { email: normalizedEmail })
          .andWhere('user.isActive = true')
          .getMany();

        if (matches.length === 0) {
          throw new UnauthorizedException('Invalid credentials');
        }
        if (matches.length > 1) {
          throw new BadRequestException(
            'Multiple organizations found for this email. Select an organization.',
          );
        }
        tenant = matches[0].tenant;
      }

      if (!tenant) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenException('This organization is suspended');
      }

      const user = await tenantUsers
        .createQueryBuilder('user')
        .where('user.tenantId = :tenantId', { tenantId: tenant.id })
        .andWhere('LOWER(user.email) = :email', { email: normalizedEmail })
        .getOne();

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.issueTokens(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          audience: TokenAudience.TENANT,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
        },
        manager,
      );
    });
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    let payload: { sub: string; aud: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.tenantDb.withBypass(async (manager) => {
      const tokenHash = this.hashToken(refreshToken);
      const refreshRepo = manager.getRepository(RefreshToken);
      const stored = await refreshRepo.findOne({
        where: { subject: payload.sub, audience: payload.aud, tokenHash },
      });
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token revoked or expired');
      }

      stored.revokedAt = new Date();
      await refreshRepo.save(stored);

      if (payload.aud === TokenAudience.PLATFORM) {
        const user = await manager.getRepository(PlatformUser).findOne({
          where: { id: payload.sub },
        });
        if (!user || !user.isActive) {
          throw new UnauthorizedException('User inactive');
        }
        return this.issueTokens(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
            audience: TokenAudience.PLATFORM,
          },
          manager,
        );
      }

      const user = await manager.getRepository(TenantUser).findOne({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User inactive');
      }
      const tenant = await manager.getRepository(Tenant).findOne({
        where: { id: user.tenantId },
      });
      if (!tenant || tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenException('Tenant unavailable');
      }
      return this.issueTokens(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          audience: TokenAudience.TENANT,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
        },
        manager,
      );
    });
  }

  async revokeRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const tokenHash = this.hashToken(refreshToken);
    await this.tenantDb.withBypass(async (manager) => {
      const stored = await manager.getRepository(RefreshToken).findOne({
        where: { tokenHash },
      });
      if (stored && !stored.revokedAt) {
        stored.revokedAt = new Date();
        await manager.getRepository(RefreshToken).save(stored);
      }
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  assertUniqueConflict(error: unknown): never {
    throw new ConflictException(
      error instanceof Error ? error.message : 'Conflict',
    );
  }

  private async issueTokens(
    input: {
      sub: string;
      email: string;
      role: string;
      audience: TokenAudience;
      tenantId?: string;
      tenantSlug?: string;
      tenantName?: string;
    },
    manager: EntityManager,
  ): Promise<IssuedTokens> {
    const accessPayload = {
      sub: input.sub,
      email: input.email,
      role: input.role,
      aud: input.audience,
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      tenantName: input.tenantName,
    };
    const accessTtl = this.config.get<string>('app.jwt.accessTtl') ?? '15m';
    const refreshTtl = this.config.get<string>('app.jwt.refreshTtl') ?? '7d';

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('app.jwt.accessSecret'),
      expiresIn: accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: input.sub, aud: input.audience, jti: randomUUID() },
      {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        expiresIn: refreshTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const expiresAt = new Date(Date.now() + this.ttlToMs(refreshTtl));
    await manager.getRepository(RefreshToken).save(
      manager.getRepository(RefreshToken).create({
        subject: input.sub,
        audience: input.audience,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user: {
        id: input.sub,
        email: input.email,
        role: input.role,
        audience: input.audience,
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        tenantName: input.tenantName,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
