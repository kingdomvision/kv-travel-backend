import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { Module as TravelModuleEntity } from './entities/module.entity';
import { PlanModule } from './entities/plan-module.entity';
import { TenantModule } from './entities/tenant-module.entity';
import { Addon } from './entities/addon.entity';
import { TenantAddon } from './entities/tenant-addon.entity';
import { TenantsService } from './tenants.service';
import { TenantUsersService } from './tenant-users.service';
import { PlansService } from './plans.service';
import { ModulesService } from './modules.service';
import { AddonsService } from './addons.service';
import { TenantAddonsService } from './tenant-addons.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { TenantPortalController } from './tenant-portal.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Plan,
      TenantUser,
      TravelModuleEntity,
      PlanModule,
      TenantModule,
      Addon,
      TenantAddon,
    ]),
    IdentityModule,
  ],
  controllers: [PlatformTenantsController, TenantPortalController],
  providers: [
    TenantsService,
    TenantUsersService,
    PlansService,
    ModulesService,
    AddonsService,
    TenantAddonsService,
  ],
  exports: [
    TenantsService,
    TenantUsersService,
    PlansService,
    ModulesService,
    AddonsService,
    TenantAddonsService,
    TypeOrmModule,
  ],
})
export class TenancyModule {}
