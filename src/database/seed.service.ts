import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Plan } from '../modules/tenancy/entities/plan.entity';
import { Tenant } from '../modules/tenancy/entities/tenant.entity';
import { TenantUser } from '../modules/tenancy/entities/tenant-user.entity';
import { PlatformUser } from '../modules/identity/entities/platform-user.entity';
import { PlatformRole, TenantRole, TenantStatus } from '../common/enums';
import { StorageService } from '../modules/storage/storage.service';
import { TenantConnectionService } from './tenant-connection.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('app.nodeEnv') === 'production') {
      return;
    }
    await this.seed();
  }

  private async seed() {
    try {
      await this.storage.ensureBucket();
    } catch (error) {
      this.logger.warn(`Storage bucket check skipped: ${String(error)}`);
    }

    const platformEmail = this.config.get<string>('app.seed.platformEmail');
    const platformPassword = this.config.get<string>(
      'app.seed.platformPassword',
    );
    const tenantEmail = this.config.get<string>('app.seed.tenantEmail');
    const tenantPassword = this.config.get<string>('app.seed.tenantPassword');

    if (
      !platformEmail ||
      !platformPassword ||
      !tenantEmail ||
      !tenantPassword
    ) {
      this.logger.warn(
        'Seed skipped: set SEED_PLATFORM_EMAIL/PASSWORD and SEED_TENANT_EMAIL/PASSWORD in .env',
      );
      return;
    }

    await this.tenantDb.withBypass(async (manager) => {
      const plans = manager.getRepository(Plan);
      const tenants = manager.getRepository(Tenant);
      const tenantUsers = manager.getRepository(TenantUser);
      const platformUsers = manager.getRepository(PlatformUser);

      let starter = await plans.findOne({ where: { code: 'starter' } });
      if (!starter) {
        starter = await plans.save(
          plans.create({
            code: 'starter',
            name: 'Starter',
            description: 'Default plan for new tenants',
            maxUsers: 25,
          }),
        );
        await plans.save(
          plans.create({
            code: 'growth',
            name: 'Growth',
            description: 'Higher limits for growing agencies',
            maxUsers: 100,
          }),
        );
      }

      let platform = await platformUsers.findOne({
        where: { email: platformEmail },
      });
      if (!platform) {
        platform = await platformUsers.save(
          platformUsers.create({
            email: platformEmail,
            fullName: 'Platform Admin',
            role: PlatformRole.SUPER_ADMIN,
            passwordHash: await bcrypt.hash(platformPassword, 12),
          }),
        );
        this.logger.log(`Seeded platform admin ${platformEmail}`);
      }

      let acme = await tenants.findOne({ where: { slug: 'acme' } });
      if (!acme) {
        acme = await tenants.save(
          tenants.create({
            slug: 'acme',
            name: 'Acme Travels',
            status: TenantStatus.ACTIVE,
            planId: starter.id,
            countryCode: 'AE',
            timezone: 'Asia/Dubai',
          }),
        );
        await tenants.save(
          tenants.create({
            slug: 'globetrotter',
            name: 'Globetrotter Agency',
            status: TenantStatus.ACTIVE,
            planId: starter.id,
            countryCode: 'GB',
            timezone: 'Europe/London',
          }),
        );
      }

      const existingAgent = await tenantUsers.findOne({
        where: { tenantId: acme.id, email: tenantEmail },
      });
      if (!existingAgent) {
        await tenantUsers.save(
          tenantUsers.create({
            tenantId: acme.id,
            email: tenantEmail,
            fullName: 'Acme Admin',
            role: TenantRole.TENANT_ADMIN,
            passwordHash: await bcrypt.hash(tenantPassword, 12),
          }),
        );
        this.logger.log(`Seeded tenant admin ${tenantEmail} for acme`);
      }
    });
  }
}
