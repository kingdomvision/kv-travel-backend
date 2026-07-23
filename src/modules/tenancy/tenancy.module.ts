import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { TenantsService } from './tenants.service';
import { TenantUsersService } from './tenant-users.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { TenantPortalController } from './tenant-portal.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Plan, TenantUser]),
    IdentityModule,
  ],
  controllers: [PlatformTenantsController, TenantPortalController],
  providers: [TenantsService, TenantUsersService],
  exports: [TenantsService, TenantUsersService, TypeOrmModule],
})
export class TenancyModule {}
