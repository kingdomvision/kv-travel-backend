import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TravelModule } from './enums';
import { AuthUser } from './decorators';
import { getTenantStore } from './tenant-context';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { TenantModule } from '../modules/tenancy/entities/tenant-module.entity';
import { TenantModuleStatus } from './enums';

export const REQUIRED_MODULES_KEY = 'required_modules';
export const RequireModules = (...modules: TravelModule[]) =>
  SetMetadata(REQUIRED_MODULES_KEY, modules);

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules = this.reflector.getAllAndOverride<TravelModule[]>(
      REQUIRED_MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No module requirement = access allowed
    if (!requiredModules?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();

    const user = request.user as AuthUser | undefined;

    // Platform admins bypass module checks
    if (user?.audience === 'platform') {
      return true;
    }

    // No user = let JwtAuthGuard handle it
    if (!user?.tenantId) {
      return true;
    }

    const store = getTenantStore();
    if (!store?.tenantId) {
      return true;
    }

    const hasAccess = await this.tenantDb.withBypass(async (manager) => {
      const tenantModules = manager.getRepository(TenantModule);
      const userModules = await tenantModules.find({
        where: {
          tenantId: store.tenantId!,
          status: TenantModuleStatus.ACTIVE,
        },
      });

      const activeModuleCodes = new Set(userModules.map((tm) => tm.moduleCode));
      return requiredModules.every((mod) => activeModuleCodes.has(mod));
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        `Your subscription does not include access to: ${requiredModules.join(', ')}. Please upgrade your plan or purchase the required addon.`,
      );
    }

    return true;
  }
}
