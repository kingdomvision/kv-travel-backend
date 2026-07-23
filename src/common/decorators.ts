import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { PlatformRole, TenantRole } from './enums';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PLATFORM_ROLES_KEY = 'platformRoles';
export const RequirePlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

export const TENANT_ROLES_KEY = 'tenantRoles';
export const RequireTenantRoles = (...roles: TenantRole[]) =>
  SetMetadata(TENANT_ROLES_KEY, roles);

export class AuthUser {
  sub!: string;
  email!: string;
  audience!: 'platform' | 'tenant';
  role!: string;
  tenantId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
