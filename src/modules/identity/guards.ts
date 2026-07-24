import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  IS_PUBLIC_KEY,
  PLATFORM_ROLES_KEY,
  TENANT_ROLES_KEY,
} from '../../common/decorators';
import { PlatformRole, TenantRole } from '../../common/enums';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { audience?: string };
    }>();
    if (request.user?.audience !== 'platform') {
      throw new UnauthorizedException('Platform access required');
    }
    return true;
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { audience?: string; tenantId?: string };
    }>();
    if (request.user?.audience !== 'tenant' || !request.user.tenantId) {
      throw new UnauthorizedException('Tenant access required');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const platformRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const tenantRoles = this.reflector.getAllAndOverride<TenantRole[]>(
      TENANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!platformRoles?.length && !tenantRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { audience?: string; role?: string };
    }>();
    const user = request.user;
    if (!user?.role) {
      throw new ForbiddenException('Insufficient role');
    }

    if (platformRoles?.length) {
      if (
        user.audience !== 'platform' ||
        !platformRoles.includes(user.role as PlatformRole)
      ) {
        throw new ForbiddenException('Insufficient platform role');
      }
      return true;
    }

    if (tenantRoles?.length) {
      if (
        user.audience !== 'tenant' ||
        !tenantRoles.includes(user.role as TenantRole)
      ) {
        throw new ForbiddenException('Insufficient tenant role');
      }
      return true;
    }

    return true;
  }
}
